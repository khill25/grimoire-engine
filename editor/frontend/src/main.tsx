import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GameTypesProvider } from './context/GameTypesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameTypesProvider>
      <App />
    </GameTypesProvider>
  </StrictMode>,
)
