import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/archivo-black';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/700.css';
import './styles.css';
import './nav.css';
import {App} from './App';

createRoot(document.getElementById('root')!).render(<App />);
