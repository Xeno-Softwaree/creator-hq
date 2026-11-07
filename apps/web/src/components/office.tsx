"use client";
import { useLanguage } from './language-provider';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Component, type ReactNode } from 'react';
class Boundary extends Component<{children:ReactNode;fallback:string},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="empty">{this.props.fallback}</div>:this.props.children}
}
function Room({x,color,ids,onSelect}:{x:number;color:string;ids:string[];onSelect:(id:string)=>void}) {
 return <group position={[x,0,0]}>
  <mesh position={[0,-.15,0]} receiveShadow><boxGeometry args={[5.6,.25,5]}/><meshStandardMaterial color="#202b3a"/></mesh>
  <mesh position={[0,1,-2.5]}><boxGeometry args={[5.6,2,.12]}/><meshStandardMaterial color="#2b394e"/></mesh>
  {ids.map((id,i)=><group key={id} position={[(i%2)*2.3-1.1,0,Math.floor(i/2)*1.8-1.2]}>
   <mesh position={[0,.65,0]}><boxGeometry args={[1.55,.12,.85]}/><meshStandardMaterial color="#576078"/></mesh>
   <mesh position={[0,1,-.2]}><boxGeometry args={[.65,.4,.08]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.3}/></mesh>
   <mesh position={[0,.65,.8]} onClick={(e)=>{e.stopPropagation();onSelect(id)}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}><capsuleGeometry args={[.23,.35,4,8]}/><meshStandardMaterial color={color}/></mesh>
  </group>)}
 </group>
}
export default function Office({onSelect}:{onSelect:(id:string)=>void}) {
 const {t}=useLanguage();
 return <Boundary fallback={t("office.unavailable")}>
  <div className="office-legend"><span style={{color:'#d4b77c'}}>{t("office.room.hq")}</span><span style={{color:'#7dd3fc'}}>{t("office.room.niko")}</span><span style={{color:'#a7f3d0'}}>{t("office.room.son")}</span></div>
  <Canvas camera={{position:[11,13,16],fov:43}} fallback={<div>{t("copy.webglUnavailableUseTheAgentDirectory")}</div>}>
   <color attach="background" args={['#101722']}/><ambientLight intensity={1.8}/><directionalLight position={[3,10,5]} intensity={2}/>
   <Room x={-6} color="#d4b77c" ids={['ceo','director','research']} onSelect={onSelect}/>
   <Room x={0} color="#7dd3fc" ids={['niko','writer','editor']} onSelect={onSelect}/>
   <Room x={6} color="#a7f3d0" ids={['son','designer','analyst']} onSelect={onSelect}/>
   <OrbitControls makeDefault target={[0,0,0]} minDistance={9} maxDistance={32} maxPolarAngle={Math.PI/2.15}/>
  </Canvas>
 </Boundary>
}
