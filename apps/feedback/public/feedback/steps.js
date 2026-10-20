(() => {
'use strict';
const es=document.documentElement.lang==='es', t=(a,b)=>es?a:b;
const form=document.querySelector('#feedback-form');if(!form)return;
form.noValidate=true;
const main=document.querySelector('main'), fields=document.querySelector('#fields');
main.querySelector(':scope > a')?.remove();
main.querySelector('h1').textContent=t('El próximo Café empieza contigo.','The next Café starts with you.');
main.querySelector('.intro').textContent=t('Lo bueno, lo difícil y lo que falta. Tu perspectiva ayuda a imaginar un mejor encuentro.','The good, the difficult, and what’s missing. Your perspective helps shape a better meetup.');
main.querySelector('.intro').nextElementSibling.textContent=t('3 pasos cortos · Las críticas son bienvenidas · Fotos opcionales','3 short steps · Honest criticism welcome · Optional photos');
const labels=[t('Sobre ti','About you'),t('Tu experiencia','Your experience'),t('Ideas y fotos','Ideas & photos'),t('Listo','Done')];
const progress=document.createElement('nav');progress.className='progress';progress.setAttribute('aria-label',t('Progreso del formulario','Form progress'));progress.innerHTML='<ol>'+labels.map((x,i)=>'<li><span>'+(i+1)+'</span>'+x+'</li>').join('')+'</ol><div class="progress-track"><div></div></div>';form.before(progress);
const titles=[t('Primero, nos presentamos.','First, a quick introduction.'),t('Cuéntanos cómo fue.','Tell us how it went.'),t('¿Algo más para el próximo Café?','Anything else for the next Café?')];
const hints=[t('Estos datos son obligatorios. Tu email ya está verificado.','These fields are required. Your email is already verified.'),t('No necesitas una experiencia positiva para responder. Cada perspectiva cuenta.','Your experience doesn’t need to be positive. Every perspective counts.'),t('Todo en este paso es opcional. Puedes terminar sin añadir nada.','Everything in this step is optional. You can finish without adding anything.')];
const sections=titles.map((title,i)=>{const s=document.createElement('section');s.className='step';s.innerHTML='<p class="step-kicker">'+t('PASO ','STEP ')+(i+1)+' / 3</p><h2 tabindex="-1">'+title+'</h2><p class="step-hint">'+hints[i]+'</p>';return s;});
for(const id of ['name','email','affiliation','role']){const el=document.getElementById(id);if(el)sections[0].append(el.closest('.field'));}
for(const id of ['feedback','improvements'])sections[1].append(document.getElementById(id).closest('.field'));
for(const id of ['sponsorQuestion','topics','photos'])sections[2].append(document.getElementById(id).closest('.field'));
const consent=fields.querySelector('.consent');sections[2].append(consent);consent.insertAdjacentHTML('beforebegin','<p class="consent-note">'+t('Permiso independiente y opcional. Las fotos se guardan de forma privada.','Separate, optional permission. Photos are stored privately.')+'</p>');
fields.replaceChildren(fields.querySelector('legend'),...sections);
const error=document.createElement('p');error.id='step-error';error.setAttribute('role','alert');fields.append(error);
const actions=document.createElement('div');actions.className='step-actions';actions.innerHTML='<button type="button" class="secondary" id="back">'+t('← Atrás','← Back')+'</button><span class="local-note">'+t('Guardado al enviar','Saved on submission')+'</span><button type="submit" class="button" id="next"></button>';fields.append(actions);
const back=actions.querySelector('#back'), next=actions.querySelector('#next');let step=0;
function show(focus=true){sections.forEach((s,i)=>s.hidden=i!==step);progress.querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('complete',i<step);if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});progress.querySelector('.progress-track div').style.width=((step+1)/4*100)+'%';back.hidden=step===0;next.textContent=step===2?t('Enviar comentarios →','Send feedback →'):t('Continuar →','Continue →');error.textContent='';if(focus)sections[step].querySelector('h2').focus();}
back.addEventListener('click',()=>{step--;show();});
form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');e.target.setCustomValidity?.('');});
form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();const controls=[...sections[step].querySelectorAll('input[required],textarea[required]')];for(const el of controls){el.setCustomValidity(el.value.trim()?'':t('Completa este campo.','Please complete this field.'));}const invalid=controls.find(el=>!el.checkValidity());if(invalid){error.textContent=t('Completa los datos obligatorios.','Complete the required fields.');invalid.focus();invalid.reportValidity();return;}if(step<2){step++;show();return;}form.dispatchEvent(new Event('feedback-submit'));},true);
show(false);
})();