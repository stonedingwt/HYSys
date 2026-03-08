import { useOutletContext } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import type { TLoginLayoutContext } from '~/common';
import LoginForm from './LoginForm';

function Login() {
  const { error, setError, login } = useAuthContext();
  const { startupConfig } = useOutletContext<TLoginLayoutContext>();

  return (
    <LoginForm
      onSubmit={login}
      startupConfig={startupConfig ?? ({} as any)}
      error={error}
      setError={setError}
    />
  );
}

export default Login;
