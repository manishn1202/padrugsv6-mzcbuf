/**
 * storage.ts
 * Core browser storage library providing type-safe, encrypted storage operations
 * for the Prior Authorization Management System frontend.
 * Version: 1.0.0
 * 
 * @packageDocumentation
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import { LOCAL_STORAGE_KEYS } from '../config/constants';

// Environment variables and constants
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY;
const STORAGE_PREFIX = 'pa_';
const ENCRYPTION_VERSION = '1';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB storage limit

/**
 * Enum for storage type selection
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Type-safe operation result interface
 */
export interface Result<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Storage value wrapper with type information and metadata
 */
interface StorageWrapper<T> {
  value: T;
  type: string;
  encryptionVersion: string;
  timestamp: number;
  isPHI: boolean;
}

/**
 * Public storage operations interface
 */
export interface StorageOperations {
  setItem<T>(key: string, value: T, storageType: StorageType, isPHI?: boolean): Promise<Result<void>>;
  getItem<T>(key: string, storageType: StorageType): Promise<Result<T | null>>;
  removeItem(key: string, storageType: StorageType): Promise<Result<void>>;
  clear(storageType: StorageType): Promise<Result<void>>;
}

/**
 * Validates storage key format
 */
const validateKey = (key: string): boolean => {
  return typeof key === 'string' && key.length > 0 && key.length <= 100;
};

/**
 * Gets the storage object based on type
 */
const getStorage = (type: StorageType): Storage => {
  return type === StorageType.LOCAL ? localStorage : sessionStorage;
};

/**
 * Encrypts data using AES encryption
 */
const encryptData = (data: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts data using AES decryption
 */
const decryptData = (encryptedData: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Checks available storage space
 */
const checkStorageQuota = (storage: Storage, dataSize: number): boolean => {
  let totalSize = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) {
      totalSize += (key.length + (storage.getItem(key)?.length || 0));
    }
  }
  return (totalSize + dataSize) <= MAX_STORAGE_SIZE;
};

/**
 * Stores data in browser storage with encryption
 * @throws Error if storage quota exceeded or encryption fails
 */
export async function setItem<T>(
  key: string,
  value: T,
  storageType: StorageType,
  isPHI: boolean = false
): Promise<Result<void>> {
  try {
    if (!validateKey(key)) {
      return { success: false, data: null, error: 'Invalid storage key' };
    }

    const storage = getStorage(storageType);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    const wrapper: StorageWrapper<T> = {
      value,
      type: typeof value,
      encryptionVersion: ENCRYPTION_VERSION,
      timestamp: Date.now(),
      isPHI
    };

    const serializedData = JSON.stringify(wrapper);
    const encryptedData = encryptData(serializedData);

    if (!checkStorageQuota(storage, encryptedData.length)) {
      return { success: false, data: null, error: 'Storage quota exceeded' };
    }

    storage.setItem(prefixedKey, encryptedData);
    return { success: true, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Retrieves and decrypts data from browser storage
 * @throws Error if decryption fails or data is invalid
 */
export async function getItem<T>(
  key: string,
  storageType: StorageType
): Promise<Result<T | null>> {
  try {
    if (!validateKey(key)) {
      return { success: false, data: null, error: 'Invalid storage key' };
    }

    const storage = getStorage(storageType);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const encryptedData = storage.getItem(prefixedKey);

    if (!encryptedData) {
      return { success: true, data: null };
    }

    const decryptedData = decryptData(encryptedData);
    const wrapper = JSON.parse(decryptedData) as StorageWrapper<T>;

    if (wrapper.encryptionVersion !== ENCRYPTION_VERSION) {
      return { success: false, data: null, error: 'Incompatible encryption version' };
    }

    return { success: true, data: wrapper.value };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: `Retrieval operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Securely removes item from browser storage
 */
export async function removeItem(
  key: string,
  storageType: StorageType
): Promise<Result<void>> {
  try {
    if (!validateKey(key)) {
      return { success: false, data: null, error: 'Invalid storage key' };
    }

    const storage = getStorage(storageType);
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    // Securely overwrite before removal
    const dummyData = CryptoJS.lib.WordArray.random(64).toString();
    storage.setItem(prefixedKey, dummyData);
    storage.removeItem(prefixedKey);

    return { success: true, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: `Remove operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Securely clears all items from specified storage
 */
export async function clear(storageType: StorageType): Promise<Result<void>> {
  try {
    const storage = getStorage(storageType);
    const keys = Object.keys(storage);
    
    // Only clear keys with our prefix
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        await removeItem(key.slice(STORAGE_PREFIX.length), storageType);
      }
    }

    return { success: true, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null, 
      error: `Clear operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Export default storage operations object
export default {
  setItem,
  getItem,
  removeItem,
  clear
} as StorageOperations;