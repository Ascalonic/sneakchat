// Using the Web Crypto API for client-side encryption
export class CryptoUtil {
  static readonly KEY_STORAGE_PREFIX = 'e2e_key_';
  private static readonly MESSAGE_ALGORITHM = {
    name: 'RSA-OAEP',
    hash: { name: 'SHA-256' }
  };
  private static readonly CHALLENGE_ALGORITHM = { 
    name: 'ECDSA', 
    namedCurve: 'P-256' 
  };

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static async generateKeyPair(): Promise<{
    messageKeys: CryptoKeyPair;
    verificationKeys: CryptoKeyPair;
  }> {
    // Generate message encryption/decryption key pair (RSA-OAEP)
    const messageKeys = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Generate verification key pair (ECDSA)
    const verificationKeys = await window.crypto.subtle.generateKey(
      this.CHALLENGE_ALGORITHM,
      true,
      ['sign', 'verify']
    );

    return { messageKeys, verificationKeys };
  }

  static async exportKeys(keys: { messageKeys: CryptoKeyPair; verificationKeys: CryptoKeyPair }): Promise<{
    publicKey: string;
    privateKey: string;
    verificationPublicKey: string;
    verificationPrivateKey: string;
  }> {
    try {
      const exportedPublic = await window.crypto.subtle.exportKey(
        'spki',
        keys.messageKeys.publicKey
      );
      const exportedPrivate = await window.crypto.subtle.exportKey(
        'pkcs8',
        keys.messageKeys.privateKey
      );
      const exportedVerificationPublic = await window.crypto.subtle.exportKey(
        'spki',
        keys.verificationKeys.publicKey
      );
      const exportedVerificationPrivate = await window.crypto.subtle.exportKey(
        'pkcs8',
        keys.verificationKeys.privateKey
      );

      return {
        publicKey: this.arrayBufferToBase64(exportedPublic),
        privateKey: this.arrayBufferToBase64(exportedPrivate),
        verificationPublicKey: this.arrayBufferToBase64(exportedVerificationPublic),
        verificationPrivateKey: this.arrayBufferToBase64(exportedVerificationPrivate)
      };
    } catch (error) {
      console.error('Error exporting keys:', error);
      throw new Error('Failed to export keys');
    }
  }

  static async importPublicKey(publicKeyStr: string): Promise<CryptoKey> {
    try {
      console.log('Importing public key:', {
        keyLength: publicKeyStr.length,
        algorithm: this.MESSAGE_ALGORITHM
      });
      
      return await window.crypto.subtle.importKey(
        'spki',
        this.base64ToArrayBuffer(publicKeyStr),
        this.MESSAGE_ALGORITHM,
        true,
        ['encrypt']
      );
    } catch (error) {
      console.error('Error importing public key:', error);
      throw new Error('Failed to import public key');
    }
  }

  static async importPrivateKey(privateKeyStr: string): Promise<CryptoKey> {
    try {
      console.log('Importing private key:', {
        keyLength: privateKeyStr.length,
        algorithm: this.MESSAGE_ALGORITHM
      });

      return await window.crypto.subtle.importKey(
        'pkcs8',
        this.base64ToArrayBuffer(privateKeyStr),
        {
          name: 'RSA-OAEP',
          hash: { name: 'SHA-256' }
        },
        true,
        ['decrypt']
      );
    } catch (error) {
      console.error('Error importing private key:', error);
      throw new Error('Failed to import private key');
    }
  }

  static async importKeys(keys: {
    publicKey: string;
    privateKey: string;
    verificationPublicKey: string;
    verificationPrivateKey: string;
  }): Promise<{
    messageKeys: CryptoKeyPair;
    verificationKeys: CryptoKeyPair;
  }> {
    try {
      const [publicKey, privateKey, verificationPublicKey, verificationPrivateKey] = await Promise.all([
        this.importPublicKey(keys.publicKey),
        this.importPrivateKey(keys.privateKey),
        window.crypto.subtle.importKey(
          'spki',
          this.base64ToArrayBuffer(keys.verificationPublicKey),
          this.CHALLENGE_ALGORITHM,
          true,
          ['verify']
        ),
        window.crypto.subtle.importKey(
          'pkcs8',
          this.base64ToArrayBuffer(keys.verificationPrivateKey),
          this.CHALLENGE_ALGORITHM,
          true,
          ['sign']
        )
      ]);

      return {
        messageKeys: { publicKey, privateKey },
        verificationKeys: { publicKey: verificationPublicKey, privateKey: verificationPrivateKey }
      };
    } catch (error) {
      console.error('Error importing keys:', error);
      throw new Error('Failed to import keys');
    }
  }

  static async encryptMessage(message: string, recipientPublicKey: string): Promise<{
    encryptedContent: string;
    encryptedKey: string;
    iv: string;
  }> {
    try {
      console.log('Starting message encryption:', {
        messageLength: message.length,
        recipientPublicKeyLength: recipientPublicKey.length
      });

      // Generate a random AES key and IV
      const aesKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the message with AES-GCM
      const encodedMessage = new TextEncoder().encode(message);
      const encryptedContent = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer },
        aesKey,
        encodedMessage
      );

      // Export the AES key
      const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
      console.log('AES key exported:', {
        keyLength: exportedAesKey.byteLength
      });

      // Import recipient's public key
      const publicKey = await this.importPublicKey(recipientPublicKey);

      // Encrypt the AES key with recipient's public key
      const encryptedKey = await window.crypto.subtle.encrypt(
        this.MESSAGE_ALGORITHM,
        publicKey,
        exportedAesKey
      );

      const result = {
        encryptedContent: this.arrayBufferToBase64(encryptedContent),
        encryptedKey: this.arrayBufferToBase64(encryptedKey),
        iv: this.arrayBufferToBase64(iv.buffer)
      };

      console.log('Encryption complete:', {
        contentLength: result.encryptedContent.length,
        keyLength: result.encryptedKey.length,
        ivLength: result.iv.length
      });

      return result;
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  static async decryptMessage(
    encryptedData: { encryptedContent: string; encryptedKey: string; iv: string },
    privateKey: CryptoKey
  ): Promise<string> {
    try {
      console.log('Starting message decryption:', {
        contentLength: encryptedData.encryptedContent.length,
        keyLength: encryptedData.encryptedKey.length,
        ivLength: encryptedData.iv.length,
        privateKeyType: privateKey.type,
        privateKeyAlgorithm: privateKey.algorithm,
        privateKeyUsages: privateKey.usages,
        privateKeyExtractable: privateKey.extractable
      });

      // Log the actual encrypted key data
      const encryptedKeyBuffer = this.base64ToArrayBuffer(encryptedData.encryptedKey);
      console.log('Encrypted AES key details:', {
        byteLength: encryptedKeyBuffer.byteLength,
        firstFewBytes: Array.from(new Uint8Array(encryptedKeyBuffer.slice(0, 4))),
        algorithm: this.MESSAGE_ALGORITHM
      });

      // Decrypt the AES key using private key
      const decryptedKeyData = await window.crypto.subtle.decrypt(
        this.MESSAGE_ALGORITHM,
        privateKey,
        encryptedKeyBuffer
      ).catch(error => {
        console.error('Failed to decrypt AES key:', error);
        console.error('Private key details:', {
          type: privateKey.type,
          algorithm: privateKey.algorithm,
          usages: privateKey.usages,
          extractable: privateKey.extractable
        });
        throw new Error('AES key decryption failed');
      });

      console.log('AES key decrypted:', {
        keyLength: decryptedKeyData.byteLength,
        firstFewBytes: Array.from(new Uint8Array(decryptedKeyData.slice(0, 4)))
      });

      // Import the decrypted AES key
      const aesKey = await window.crypto.subtle.importKey(
        'raw',
        decryptedKeyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      ).catch(error => {
        console.error('Failed to import AES key:', error);
        throw new Error('AES key import failed');
      });

      console.log('AES key imported successfully:', {
        type: aesKey.type,
        algorithm: aesKey.algorithm,
        usages: aesKey.usages
      });

      // Decrypt the content using AES-GCM
      const decryptedContent = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: this.base64ToArrayBuffer(encryptedData.iv)
        },
        aesKey,
        this.base64ToArrayBuffer(encryptedData.encryptedContent)
      ).catch(error => {
        console.error('Failed to decrypt content with AES:', error);
        throw new Error('Content decryption failed');
      });

      const result = new TextDecoder().decode(decryptedContent);
      console.log('Decryption complete:', {
        decryptedLength: result.length,
        firstFewChars: result.slice(0, 10)
      });

      return result;
    } catch (error) {
      console.error('Detailed decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  static async signChallenge(challenge: string, privateKey: CryptoKey): Promise<string> {
    const signature = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      privateKey,
      new TextEncoder().encode(challenge)
    );
    return this.arrayBufferToBase64(signature);
  }

  static async verifyChallenge(
    challenge: string,
    signature: string,
    publicKey: CryptoKey
  ): Promise<boolean> {
    return window.crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      this.base64ToArrayBuffer(signature),
      new TextEncoder().encode(challenge)
    );
  }

  private static async encryptStorageKey(key: string, userId: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const salt = window.crypto.getRandomValues(new Uint8Array(16)).buffer;
    
    // Derive a key from the userId (acts as a password)
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(userId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12)).buffer;
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      keyData
    );
    
    return JSON.stringify({
      data: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      salt: this.arrayBufferToBase64(salt)
    });
  }

  private static async decryptStorageKey(encryptedData: string, userId: string): Promise<string> {
    const { data, iv, salt } = JSON.parse(encryptedData);
    const encoder = new TextEncoder();
    
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(userId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.base64ToArrayBuffer(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.base64ToArrayBuffer(iv)
      },
      derivedKey,
      this.base64ToArrayBuffer(data)
    );
    
    return new TextDecoder().decode(decrypted);
  }

  private static async initializeDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('e2e_keys', 1);
      
      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('Database upgrade needed, creating schema');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create store if it doesn't exist
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
          console.log('Created "keys" object store');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        console.log('Database opened successfully');
        resolve(db);
      };
    });
  }

  static async storeKeys(userId: string, keys: { messageKeys: CryptoKeyPair; verificationKeys: CryptoKeyPair }) {
    let db: IDBDatabase | null = null;
    try {
      // Validate keys before exporting
      if (!keys.messageKeys.publicKey || !keys.messageKeys.privateKey) {
        throw new Error('Invalid key pair: Missing public or private key');
      }

      // Verify the key pair works before storing
      const testMessage = 'test';
      const testEncrypted = await window.crypto.subtle.encrypt(
        this.MESSAGE_ALGORITHM,
        keys.messageKeys.publicKey,
        new TextEncoder().encode(testMessage)
      );
      
      await window.crypto.subtle.decrypt(
        this.MESSAGE_ALGORITHM,
        keys.messageKeys.privateKey,
        testEncrypted
      );

      const exportedKeys = await this.exportKeys(keys);
      
      // Encrypt the keys before storing
      const encryptedKeys = await this.encryptStorageKey(JSON.stringify({
        ...exportedKeys,
        timestamp: Date.now()
      }), userId);
      
      // Initialize and open database
      db = await this.initializeDB();
      
      // Store in IndexedDB
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db!.transaction(['keys'], 'readwrite');
          const store = transaction.objectStore('keys');
          
          transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
          };
          
          const request = store.put(encryptedKeys, userId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      console.log('Stored encrypted keys for user:', {
        userId,
        publicKeyLength: exportedKeys.publicKey.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      console.error('Error storing keys:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error('Failed to store keys: ' + errorMessage);
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  static async getStoredKeys(userId: string): Promise<{ messageKeys: CryptoKeyPair; verificationKeys: CryptoKeyPair } | null> {
    let db: IDBDatabase | null = null;
    try {
      // Initialize and open database
      db = await this.initializeDB();
      
      const encryptedKeys = await new Promise<string | undefined>((resolve, reject) => {
        try {
          const transaction = db!.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          
          transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
          };
          
          const request = store.get(userId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!encryptedKeys) {
        console.log('No stored keys found for user:', userId);
        return null;
      }
      
      try {
        const decryptedData = await this.decryptStorageKey(encryptedKeys, userId);
        const parsedKeys = JSON.parse(decryptedData);
        
        // Validate key format
        if (!parsedKeys.publicKey || !parsedKeys.privateKey) {
          console.error('Invalid key format in storage');
          await this.clearStoredKeys(userId);
          return null;
        }

        console.log('Retrieved stored keys:', {
          userId,
          publicKeyLength: parsedKeys.publicKey.length,
          timestamp: parsedKeys.timestamp ? new Date(parsedKeys.timestamp).toISOString() : 'unknown'
        });
        
        const importedKeys = await this.importKeys(parsedKeys);

        // Verify the imported keys work
        try {
          const testMessage = 'test';
          const testEncrypted = await window.crypto.subtle.encrypt(
            this.MESSAGE_ALGORITHM,
            importedKeys.messageKeys.publicKey,
            new TextEncoder().encode(testMessage)
          );
          
          await window.crypto.subtle.decrypt(
            this.MESSAGE_ALGORITHM,
            importedKeys.messageKeys.privateKey,
            testEncrypted
          );
          
          return importedKeys;
        } catch (verifyError) {
          console.error('Stored keys verification failed:', verifyError);
          await this.clearStoredKeys(userId);
          return null;
        }
      } catch (parseError) {
        console.error('Error parsing stored keys:', parseError);
        await this.clearStoredKeys(userId);
        return null;
      }
    } catch (error) {
      console.error('Error retrieving keys:', error);
      return null;
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  private static async clearStoredKeys(userId: string) {
    let db: IDBDatabase | null = null;
    try {
      db = await this.initializeDB();
      
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db!.transaction(['keys'], 'readwrite');
          const store = transaction.objectStore('keys');
          
          transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
          };
          
          const request = store.delete(userId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error clearing stored keys:', error);
      throw error;
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  static async generateAndStoreKeys(userId: string): Promise<{ messageKeys: CryptoKeyPair; verificationKeys: CryptoKeyPair }> {
    try {
      console.log('Generating new keys for user:', userId);
      const keys = await this.generateKeyPair();
      await this.storeKeys(userId, keys);
      return keys;
    } catch (error) {
      console.error('Error generating and storing keys:', error);
      throw new Error('Failed to generate and store keys');
    }
  }
} 