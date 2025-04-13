// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
// *** 從 utils 文件導入 decodeToken ***
import { decodeToken } from '../utils/authUtils'; // 確保路徑正確

// 1. 創建 Auth Context
// 初始值設為 undefined，以便 useAuth hook 可以檢測是否在 Provider 內
const AuthContext = createContext(undefined);

// *** 移除這裡內部的 decodeToken 函數定義 ***


// 2. 創建 Auth Provider 元件
export const AuthProvider = ({ children }) => {
    // --- State 定義 ---
    const [user, setUser] = useState(null); // 存儲已登入用戶的信息對象，或 null
    const [isLoading, setIsLoading] = useState(true); // 標記初始加載狀態 (檢查 localStorage)
    const [isAuthenticated, setIsAuthenticated] = useState(false); // 標記是否已認證

    // --- 效果：組件首次掛載時，嘗試從 localStorage 恢復登入狀態 ---
    useEffect(() => {
        console.log('[AuthProvider] useEffect triggered: Checking local storage...');
        const storedToken = localStorage.getItem('authToken'); // 讀取存儲的 Token
        if (storedToken) {
            // 如果找到 Token，嘗試解碼
            const decodedUser = decodeToken(storedToken); // 使用導入的 decodeToken
            if (decodedUser) {
                // 解碼成功，認為用戶已登入
                // 注意：這裡沒有驗證 Token 是否真的仍然有效（例如後端密鑰是否更改），
                // 可以在需要高安全性的操作前，通過 API 請求來驗證 Token。
                setUser(decodedUser); // 設置用戶狀態
                setIsAuthenticated(true); // 設置認證狀態
                console.log('[AuthProvider] User loaded from localStorage:', decodedUser.username);
            } else {
                // Token 無效或過期，清除 localStorage
                localStorage.removeItem('authToken');
                setIsAuthenticated(false); // 確保設置為未認證
                console.log('[AuthProvider] Invalid token found in localStorage, removed.');
            }
        } else {
            // localStorage 中沒有 Token
            console.log('[AuthProvider] No token found in local storage.');
            setIsAuthenticated(false); // 確保設置為未認證
        }
        // 無論如何，初始檢查完成後，設置 isLoading 為 false
        setIsLoading(false);
    }, []); // 空依賴數組，確保只在組件首次掛載時執行一次

    // --- 登入函數 ---
    // 使用 useCallback 包裹以獲得穩定的函數引用
    const login = useCallback(async (username, password) => {
        console.log('[AuthProvider] Attempting login...');
        try {
            // 調用後端登入 API
            const response = await apiClient.post('/auth/login', { username, password });
            // 檢查響應是否成功且包含 token
            if (response.data?.success && response.data?.data?.token) {
                const { token } = response.data.data;
                // 1. 將 Token 存儲到 localStorage
                localStorage.setItem('authToken', token);
                // 2. 解碼 Token 以獲取用戶信息
                const decodedUser = decodeToken(token); // 使用導入的 decodeToken
                 if (decodedUser) {
                     // 3. 更新 React 狀態
                     setUser(decodedUser);
                     setIsAuthenticated(true);
                     console.log('[AuthProvider] Login successful for:', decodedUser.username);
                     return { success: true, user: decodedUser }; // 返回成功標誌和用戶信息
                 } else {
                      // 解碼失敗，這是異常情況
                      throw new Error('登入成功但無法解析用戶信息');
                 }
            } else {
                 // API 返回不成功或數據格式錯誤
                 throw new Error(response.data?.message || '登入失敗，響應格式錯誤');
            }
        } catch (error) {
            console.error("[AuthProvider] Login failed:", error?.response?.data?.message || error?.message || error);
            // 登入失敗時，確保清除狀態和存儲
            localStorage.removeItem('authToken');
            setUser(null);
            setIsAuthenticated(false);
            // 返回失敗標誌和錯誤信息
            return { success: false, message: error?.response?.data?.message || error?.message || '登入時發生錯誤' };
        }
    }, []); // login 函數本身沒有外部依賴

    // --- 登出函數 ---
    const logout = useCallback(() => {
        console.log('[AuthProvider] Logging out...');
        // 1. 從 localStorage 移除 Token
        localStorage.removeItem('authToken');
        // 2. 清除 React 狀態
        setUser(null);
        setIsAuthenticated(false);
        // 可選：調用後端登出接口 (如果需要讓後端知道登出，例如記錄日誌或使 Token 失效)
        // apiClient.post('/auth/logout').catch(err => console.error("Logout API call failed:", err));
        console.log('[AuthProvider] Logout completed.');
        // 可選：登出後跳轉 (通常在調用 logout 的組件中處理)
        // navigate('/login');
    }, []); // logout 函數本身沒有外部依賴

    // --- Context 的值 ---
    // 將所有需要全局共享的狀態和函數放入 value 對象
    const value = {
        user,              // 當前用戶信息 (對象或 null)
        isLoading,         // 初始認證狀態是否加載中 (布爾值)
        isAuthenticated,   // 當前是否已認證 (布爾值)
        login,             // 登入函數
        logout,            // 登出函數
        // 你可以在這裡添加更多狀態或函數，例如
        // refreshUser: () => { /* 重新從 API 獲取用戶信息並更新 user 狀態 */ }
    };

    // --- 返回 Provider ---
    // 使用 AuthContext.Provider 將 value 提供給其所有子組件
    return (
        <AuthContext.Provider value={value}>
            {children} {/* 渲染被 AuthProvider 包裹的子組件 */}
        </AuthContext.Provider>
    );
};

// 導出 Context 本身，以便 useAuth hook 可以使用
export default AuthContext;