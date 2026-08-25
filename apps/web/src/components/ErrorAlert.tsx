import { Alert } from '@mui/material';

/** role="alert" is passed explicitly (not relied on as an MUI internal
 * default) since every page's own error state depends on it resolving. */
export function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert severity="error" role="alert" sx={{ my: 1 }}>
      {message}
    </Alert>
  );
}
