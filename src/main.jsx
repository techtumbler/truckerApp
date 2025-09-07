// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/app.css'
import App from './App.jsx'
import Timer from './routes/Timer.jsx'
import Map from './routes/Map.jsx'
import Docs from './routes/Docs.jsx'
import Lsva from './routes/Lsva.jsx'

const router = createBrowserRouter([
  { path: '/', element: <App/>, children: [
    { index: true, element: <Timer/> },
    { path: 'map', element: <Map/> },
    { path: 'docs', element: <Docs/> },
    { path: 'lsva', element: <Lsva/> }
  ]}
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router}/>)
