import { useAuth as useAuthFromContext } from '../modules/auth/context/AuthContext';

export const useAuth = () => {
  const auth = useAuthFromContext();
  return {
    ...auth,
    loading: auth.isLoading,
  };
};
