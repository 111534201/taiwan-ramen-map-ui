// src/hooks/useAuth.js (最終版本 - 使用默認導出)
import AuthContext from '../context/AuthContext';
import React, { useContext } from 'react';

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必須在 AuthProvider 內部使用');
  }
  return context;
};

export default useAuth; // 使用默認導出