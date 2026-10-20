const form=document.querySelector('#feedback-form'),fields=document.querySelector('#fields'),status=document.querySelector('#status'),retry=document.querySelector('#retry'),send=document.querySelector('#next')||document.querySelector('#send');
const es=document.documentElement.lang==='es';let token=null,readyAt=0;
async function connect(){
 fields.disabled=true;retry.hidden=true;status.textContent=status.dataset.loading;
 try{const r=await fetch('/api/feedback/challenge',{referrerPolicy:'same-origin',headers:{'X-Feedback-Client':'web'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const body=await r.json();token=body.token;readyAt=Date.now()+2100;fields.disabled=false;status.textContent='';}
 catch{status.textContent=status.dataset.unavailable;retry.hidden=false;}
}
async function normalize(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024)throw Error(es?'Usa fotos JPEG, PNG o WebP de hasta 4 MB.':'Use JPEG, PNG or WebP photos up to 4 MB.');
 const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>40000000)throw Error(es?'La foto es demasiado grande.':'The photo dimensions are too large.');const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob||blob.size>4*1024*1024)throw Error(es?'No se pudo preparar la foto.':'Could not prepare the photo.');return blob;}finally{bitmap.close();}
}
form.addEventListener('feedback-submit',async event=>{
 event.preventDefault();if(!token)return;
 const data=new FormData(form),photos=form.photoPicker?.getFiles()||[...document.querySelector('#photos').files];
 if(!['feedback','improvements','sponsorQuestion','topics'].some(k=>data.get(k).trim())){status.textContent=es?'Responde al menos una pregunta.':'Answer at least one question.';status.focus();return;}
 if(photos.length>20){status.textContent=es?'Puedes enviar hasta 20 fotos.':'You can send up to 20 photos.';status.focus();return;}
 fields.disabled=true;send.disabled=true;retry.hidden=true;status.textContent=es?'Enviando…':'Sending…';
 try{
  data.delete('photos');data.set('photoConsent',data.get('photoConsent')==='true'?'true':'false');
  if(form.dataset.auth!=='true')for(const [i,file]of photos.entries())data.append('photos',await normalize(file),`photo-${i+1}.jpg`);
  data.set('token',token);if(Date.now()<readyAt)await new Promise(r=>setTimeout(r,readyAt-Date.now()));
  const response=await fetch('/api/feedback',{method:'POST',body:data,signal:AbortSignal.timeout(45000)}),body=await response.json();
  if(!response.ok){if(response.status===400||response.status===409){token=null;retry.hidden=false;}throw Error(response.status===429?(es?'Espera un minuto e inténtalo de nuevo.':'Wait a minute and try again.'):response.status===400?(es?'Revisa tus respuestas o renueva la conexión.':'Check your answers or renew the connection.'):(es?'No pudimos confirmar el envío. Conserva tus respuestas e inténtalo de nuevo.':'Could not confirm receipt. Keep your answers and try again.'));}
  if(form.dataset.auth==='true'){for(const [i,file] of photos.entries()){status.textContent=(es?'Guardando foto ':'Saving photo ')+(i+1)+' / '+photos.length;const r=await fetch('/api/feedback/photo?id='+encodeURIComponent(body.id)+'&slot='+i,{method:'POST',headers:{'Content-Type':'image/jpeg','X-CSRF-Token':data.get('csrf')},body:await normalize(file),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(es?'La respuesta está guardada. Reintenta para completar las fotos.':'Feedback is saved. Retry to finish uploading photos.');}}
  status.textContent=`${status.dataset.saved} ${es?'Recibo':'Receipt'}: ${body.id}`;if(form.dataset.auth==='true'){location.assign(es?'/feedback/credit':'/en/feedback/credit');return;}form.reset();token=null;status.focus();
 }catch(err){status.textContent=err.message||status.dataset.unavailable;fields.disabled=false;send.disabled=false;status.focus();}
});
retry.addEventListener('click',connect);connect();
