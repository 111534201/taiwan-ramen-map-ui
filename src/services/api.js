// src/services/api.js
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // 可能在 AuthContext 中使用，這裡不需要

// 從環境變數讀取後端 API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

console.log('[API Client] Base URL:', API_BASE_URL);

// --- 創建 axios 實例 ---
const apiClient = axios.create({
  baseURL: API_BASE_URL + '/api', // 將 /api 前綴加到基礎 URL
  // *** 不要在這裡全局設置 Content-Type ***
  // headers: {
  //   'Content-Type': 'application/json', // <-- 已移除
  // },
});

// --- 請求攔截器：自動附加 JWT Token ---
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken'); // 從 localStorage 獲取 Token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`; // 添加 Authorization 頭
    }

    // *** 不再需要手動處理 Content-Type ***
    // axios 會根據 config.data 的類型 (普通對象 vs FormData) 自動設置
    // if (config.data instanceof FormData) {
    //     delete config.headers['Content-Type']; // 移除這行，讓瀏覽器自動處理
    // }

    // 打印請求信息 (調試用，生產環境可移除)
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.params || '', config.data instanceof FormData ? '(FormData)' : (config.data || '') );

    return config;
  },
  (error) => {
    // 對請求錯誤做些什麼
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// --- 響應攔截器：全局錯誤處理 ---
apiClient.interceptors.response.use(
  (response) => {
    // 對響應數據做點什麼 (例如，只返回 data 部分)
    // return response.data; // 如果總是想直接用 data
    return response; // 返回完整響應對象
  },
  (error) => {
    // 對響應錯誤做點什麼
    console.error('[API Response Error]', error.response || error.message || error);

    if (error.response) {
      // 伺服器返回了錯誤狀態碼 (4xx, 5xx)
      const { status, data } = error.response;
      const errorMessage = data?.message || error.message || '發生未知伺服器錯誤';

      if (status === 401) { // 未授權
        console.error('API Error 401: 未授權', errorMessage);
        // 可以在這裡觸發全局登出邏輯
        localStorage.removeItem('authToken');
        // 避免在非瀏覽器環境下執行
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
             alert('您的登入已過期或無效，請重新登入。');
             window.location.href = '/login'; // 強制跳轉
        }
      } else if (status === 403) { // 禁止訪問
        console.error('API Error 403: 權限不足', errorMessage);
        // 可以在這裡顯示全局提示
        alert(`權限不足：${errorMessage}`);
      } else if (status === 404) { // 資源未找到
        console.error('API Error 404: 資源未找到', errorMessage);
         // 通常由調用方處理，但也可以在這裡提示
         // alert(`找不到資源：${errorMessage}`);
      } else if (status === 400) { // 錯誤請求
          console.error('API Error 400: 錯誤的請求', errorMessage);
      } else if (status === 409) { // 衝突 (例如帳號已存在)
          console.error('API Error 409: 資源衝突', errorMessage);
      } else if (status === 413) { // Payload Too Large
           console.error('API Error 413: 請求體過大', errorMessage);
           alert(`上傳失敗：${errorMessage || '文件大小超過限制'}`);
      } else { // 其他 5xx 或 4xx 錯誤
        console.error(`API Error ${status}: ${errorMessage}`);
         // 可以顯示通用錯誤提示
         // alert(`請求失敗 (${status}): ${errorMessage}`);
      }
       // *** 重要：拋出包含後端響應的錯誤，以便頁面組件能獲取 message ***
       return Promise.reject(error.response);
    } else if (error.request) {
      // 請求已發出但沒有收到響應
      console.error('API Network Error:', error.request);
      alert('網路錯誤或無法連接到伺服器，請檢查您的網路連線並稍後重試。');
    } else {
      // 設置請求時觸發了錯誤
      console.error('API Request Setup Error:', error.message);
      alert(`發送請求時發生錯誤: ${error.message}`);
    }

    // 返回一個 reject 的 Promise，可以包含一個標準化的錯誤對象
     return Promise.reject({ message: error.message || '發生未知錯誤' }); // 或者直接 reject(error)
  }
);

export default apiClient; // 導出配置好的 axios 實例