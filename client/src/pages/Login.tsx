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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

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
  email: yup
    .string()
    .email('Enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password should be of minimum 6 characters length')
    .required('Password is required'),
});

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        await login(values.email, values.password);
        navigate('/');
      } catch (error) {
        console.error('Login failed:', error);
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
            <LockOutlinedIcon sx={{ color: '#fff', fontSize: 32 }} />
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
            Welcome Back
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
              id="email"
              name="email"
              label="Email Address"
              value={formik.values.email}
              onChange={formik.handleChange}
              error={formik.touched.email && Boolean(formik.errors.email)}
              helperText={formik.touched.email && formik.errors.email}
              autoComplete="email"
              autoFocus
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
              autoComplete="current-password"
            />
            <StyledButton
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </StyledButton>
            <Box sx={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
              <Link
                component={RouterLink}
                to="/register"
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
                {"Don't have an account? Sign Up"}
              </Link>
            </Box>
          </Box>
        </StyledPaper>
      </Box>
    </Container>
  );
};

export default Login; 