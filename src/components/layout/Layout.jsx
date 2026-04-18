import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  return (
    <div id="app" className="active">
      <Sidebar />
      <div className="sidebar-overlay" id="sidebarOverlay"></div>
      
      <Header />
      
      <main className="main-content">
        <Outlet />
      </main>
      
      <div className="toast-container" id="toastContainer"></div>
    </div>
  );
};

export default Layout;
