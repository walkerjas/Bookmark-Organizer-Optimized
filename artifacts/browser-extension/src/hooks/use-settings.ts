import { useState, useCallback } from "react";

export type Settings = {
  apiUrl: string;
};

const API_URL_KEY = "markbase_api_url";

export function useSettings() {
  const [apiUrl, setApiUrlState] = useState<string>(
    () => localStorage.getItem(API_URL_KEY) ?? "",
  );

  const setApiUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    localStorage.setItem(API_URL_KEY, trimmed);
    setApiUrlState(trimmed);
  }, []);

  return { apiUrl, setApiUrl };
}
