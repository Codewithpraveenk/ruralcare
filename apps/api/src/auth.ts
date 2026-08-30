import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

export type Role="CITIZEN"|"ASHA"|"DOCTOR"|"FACILITY_ADMIN"|"STAFF";
export type SessionUser={id:string;name:string;email:string|null;phone:string|null;role:Role;facilityId:string|null;preferredLanguage:"en"|"ta";village:string|null};
export type AuthRequest=Request&{user?:SessionUser};
export const cookieName="ruralcare_session";
const ephemeralDevelopmentSecret=randomBytes(32).toString("hex");
const secret=()=>{if(process.env.AUTH_SECRET)return process.env.AUTH_SECRET;if(process.env.NODE_ENV==="production")throw new Error("AUTH_SECRET is required in production.");return ephemeralDevelopmentSecret;};
const cookieOptions=()=>({httpOnly:true,secure:process.env.COOKIE_SECURE==="true"||process.env.NODE_ENV==="production",sameSite:(process.env.COOKIE_SAME_SITE==="none"?"none":"lax") as "none"|"lax",path:"/"} as const);

export function issueSession(res:Response,user:SessionUser){const token=jwt.sign({sub:user.id,name:user.name,email:user.email,phone:user.phone,role:user.role,facilityId:user.facilityId,preferredLanguage:user.preferredLanguage,village:user.village},secret(),{expiresIn:"8h",issuer:"ruralcare-connect",audience:"ruralcare-web"});res.cookie(cookieName,token,{...cookieOptions(),maxAge:8*60*60*1000});}
export function clearSession(res:Response){res.clearCookie(cookieName,cookieOptions());}
export function requireAuth(req:AuthRequest,res:Response,next:NextFunction){const token=req.cookies?.[cookieName];if(!token)return res.status(401).json({error:"Please sign in again."});try{const payload=jwt.verify(token,secret(),{issuer:"ruralcare-connect",audience:"ruralcare-web"}) as jwt.JwtPayload;req.user={id:String(payload.sub),name:String(payload.name),email:payload.email?String(payload.email):null,phone:payload.phone?String(payload.phone):null,role:payload.role as Role,facilityId:payload.facilityId?String(payload.facilityId):null,preferredLanguage:payload.preferredLanguage==="ta"?"ta":"en",village:payload.village?String(payload.village):null};next();}catch{return res.status(401).json({error:"Your session expired. Please sign in again."});}}
export const requireRole=(...roles:Role[])=>(req:AuthRequest,res:Response,next:NextFunction)=>req.user&&(roles.includes(req.user.role)||(req.user.role==="FACILITY_ADMIN"&&roles.includes("STAFF")))?next():res.status(403).json({error:"You do not have access to this action."});
