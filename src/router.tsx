import { createBrowserRouter, Navigate } from 'react-router-dom';
import CharacterSheetPage from './pages/CharacterSheetPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/en" replace />
  },
  {
    path: '/:locale',
    element: <CharacterSheetPage />
  }
]);