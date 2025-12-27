import { createBrowserRouter } from 'react-router-dom';
import CharacterSheetPage from './pages/CharacterSheetPage';
import { ErrorBoundary } from './components/error-boundary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <CharacterSheetPage />,
    errorElement: <ErrorBoundary />
  }
]);