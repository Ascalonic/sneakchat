import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Paper,
  alpha,
  styled,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: 'var(--secondary-bg)',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  animation: 'scaleIn 0.3s ease-out',
  '& .MuiTextField-root': {
    marginBottom: theme.spacing(2),
  },
}));

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha('#000', 0.2),
    '& fieldset': {
      borderColor: 'var(--border-color)',
    },
    '&:hover fieldset': {
      borderColor: 'var(--accent-color)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--accent-color)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--text-secondary)',
    '&.Mui-focused': {
      color: 'var(--accent-color)',
    },
  },
  '& .MuiOutlinedInput-input': {
    color: 'var(--text-primary)',
  },
  '& .MuiFormHelperText-root': {
    color: 'var(--text-secondary)',
    '&.Mui-error': {
      color: '#f44336',
    },
  },
});

const StyledButton = styled(Button)({
  backgroundColor: 'var(--accent-color)',
  padding: '12px',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '1rem',
  fontWeight: 600,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha('#0D99FF', 0.8),
    transform: 'translateY(-2px)',
    boxShadow: '0 5px 15px rgba(13, 153, 255, 0.2)',
  },
});

const IconWrapper = styled(Box)({
  backgroundColor: 'var(--accent-color)',
  borderRadius: '50%',
  padding: '16px',
  marginBottom: '16px',
  animation: 'fadeIn 0.5s ease-out',
});

const validationSchema = yup.object({
  username: yup
    .string()
    .min(3, 'Username should be of minimum 3 characters length')
    .required('Username is required'),
  email: yup
    .string()
    .email('Enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password should be of minimum 6 characters length')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm Password is required'),
});

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const formik = useFormik({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        await register(values.username, values.email, values.password);
        navigate('/');
      } catch (error) {
        console.error('Registration failed:', error);
      }
    },
  });

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StyledPaper elevation={0}>
          <IconWrapper>
            <PersonAddOutlinedIcon sx={{ color: '#fff', fontSize: 32 }} />
          </IconWrapper>
          <Typography
            component="h1"
            variant="h4"
            sx={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              marginBottom: 3,
              animation: 'fadeIn 0.5s ease-out 0.2s both',
            }}
          >
            Create Account
          </Typography>
          <Box
            component="form"
            onSubmit={formik.handleSubmit}
            sx={{
              width: '100%',
              animation: 'slideIn 0.5s ease-out 0.3s both',
            }}
          >
            <StyledTextField
              margin="normal"
              fullWidth
              id="username"
              name="username"
              label="Username"
              value={formik.values.username}
              onChange={formik.handleChange}
              error={formik.touched.username && Boolean(formik.errors.username)}
              helperText={formik.touched.username && formik.errors.username}
              autoComplete="username"
              autoFocus
            />
            <StyledTextField
              margin="normal"
              fullWidth
              id="email"
              name="email"
              label="Email Address"
              value={formik.values.email}
              onChange={formik.handleChange}
              error={formik.touched.email && Boolean(formik.errors.email)}
              helperText={formik.touched.email && formik.errors.email}
              autoComplete="email"
            />
            <StyledTextField
              margin="normal"
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
              autoComplete="new-password"
            />
            <StyledTextField
              margin="normal"
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
              helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
              autoComplete="new-password"
            />
            <StyledButton
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Create Account
            </StyledButton>
            <Box sx={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
              <Link
                component={RouterLink}
                to="/login"
                sx={{
                  color: 'var(--accent-color)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    color: alpha('#0D99FF', 0.8),
                    textDecoration: 'none',
                  },
                }}
              >
                {"Already have an account? Sign In"}
              </Link>
            </Box>
          </Box>
        </StyledPaper>
      </Box>
    </Container>
  );
};

export default Register; 