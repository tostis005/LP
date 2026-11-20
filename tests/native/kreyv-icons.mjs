import assert from "node:assert/strict";
import pg from "pg";
const pool=new pg.Pool({host:process.env.PGHOST||"127.0.0.1",port:Number(process.env.PGPORT||5432),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
try{
 const {rows}=await pool.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='businesses_stamp_icon_check' AND conrelid='public.businesses'::regclass");
 assert.equal(rows.length,1,"Stamp icon validation constraint must exist");
 const rule=rows[0].definition;
 for(const value of ["coffee","burger","restaurant","beard","hair","pizza","bread","croissant","icecream","flower","scissors","star","heart","gift","taco","donut","gym","spa","pet","nails","book","car","bicycle","juice","cafeteria","restaurante","hamburgueseria","pizzeria","taqueria","panaderia","pasteleria","heladeria","bar","vinoteca","gastronomia","comida-para-llevar","tienda","comercio","peluqueria","barberia","gimnasio","bienestar","salud","mascotas","libreria","ocio","eventos"])assert.ok(rule.includes("'"+value+"'"),"Missing allowed stamp icon "+value);
 console.log("OK: legacy and new Kreyv stamp icon IDs are supported by PostgreSQL.");
}finally{await pool.end()}
