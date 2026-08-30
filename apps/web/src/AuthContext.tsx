import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AuthUser={id:string;name:string;email:string|null;phone:string|null;role:"CITIZEN"|"ASHA"|"DOCTOR"|"FACILITY_ADMIN"|"STAFF";facilityId:string|null;preferredLanguage:"en"|"ta";village:string|null};
type Registration={name:string;email?:string;phone?:string;password:string;confirmPassword:string;preferredLanguage?:"en"|"ta";village?:string};
type AuthValue={user:AuthUser|null;loading:boolean;isLoading:boolean;isAuthenticated:boolean;error:string;login:(email:string,password:string)=>Promise<void>;loginWithGoogle:(credential:string)=>Promise<void>;register:(input:Registration)=>Promise<void>;logout:()=>Promise<void>;refreshUser:()=>Promise<void>;clearError:()=>void};
const AuthContext=createContext<AuthValue|null>(null);
const apiBase=(import.meta.env.VITE_API_URL||"").replace(/\/$/,"");
async function authRequest(path:string,init?:RequestInit){const response=await fetch(`${apiBase}${path}`,{credentials:"include",headers:{"Content-Type":"application/json"},...init}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Authentication request failed.");return data;}
export function AuthProvider({children}:{children:ReactNode}){
 const[user,setUser]=useState<AuthUser|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const refreshUser=async()=>{try{const result=await authRequest("/api/auth/me");setUser(result.user);}catch{setUser(null);}finally{setLoading(false);}};
 useEffect(()=>{void refreshUser();const expired=()=>setUser(null);addEventListener("ruralcare-auth-expired",expired);return()=>removeEventListener("ruralcare-auth-expired",expired);},[]);
 const login=async(email:string,password:string)=>{setError("");try{const result=await authRequest("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})});setUser(result.user);}catch(reason){const message=reason instanceof Error?reason.message:"Login failed.";setError(message);throw reason;}};
 const loginWithGoogle=async(credential:string)=>{setError("");try{const result=await authRequest("/api/auth/google",{method:"POST",body:JSON.stringify({credential})});setUser(result.user);}catch(reason){const message=reason instanceof Error?reason.message:"Google sign-in could not be completed. Please try again or use email and password.";setError(message);throw reason;}};
 const register=async(input:Registration)=>{setError("");try{const result=await authRequest("/api/auth/register",{method:"POST",body:JSON.stringify(input)});setUser(result.user);}catch(reason){const message=reason instanceof Error?reason.message:"Registration failed.";setError(message);throw reason;}};
 const logout=async()=>{await authRequest("/api/auth/logout",{method:"POST"}).catch(()=>undefined);setUser(null);};
 const value=useMemo(()=>({user,loading,isLoading:loading,isAuthenticated:Boolean(user),error,login,loginWithGoogle,register,logout,refreshUser,clearError:()=>setError("")}),[user,loading,error]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("AuthProvider is missing");return value;}
