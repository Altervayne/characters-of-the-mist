import { createBrowserRouter, Navigate } from 'react-router-dom';
import CharacterSheetPage from './pages/CharacterSheetPage';
import { RouterErrorBoundary } from './components/error-boundary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <CharacterSheetPage />,
    errorElement: <RouterErrorBoundary />
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);