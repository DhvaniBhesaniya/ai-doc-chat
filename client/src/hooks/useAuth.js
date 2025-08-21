import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient.js";

export function useCurrentUser() {
  return useQuery({ queryKey: ["/api/auth/me"] });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password, name }) => {
      const res = await apiRequest("POST", "/api/auth/register", { email, password, name });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });
} 