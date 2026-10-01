import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './theme.css';
import './features.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Pizzeria POS:', error, info); }
  render() {
    if (this.state.error) return <div style={{padding:40,fontFamily:'Arial',background:'#f7f2eb',minHeight:'100vh'}}>
      <h1>Error al cargar el sistema</h1><p>{this.state.error.message}</p>
      <p>Presiona F12 → Console para ver el detalle.</p>
    </div>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
);
