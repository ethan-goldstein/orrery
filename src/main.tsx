import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { Fallback } from './ui/Fallback';
import { Renderer } from './engine/Renderer';
import './styles.css';

const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode>{Renderer.supported() ? <App /> : <Fallback />}</StrictMode>);
