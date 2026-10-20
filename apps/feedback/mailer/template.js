import {escapeHTML as esc} from '../config.js';
export function renderMagic(lang,name,link,config={}){
 if(!['es','en'].includes(lang))throw Error('Invalid language');
 name=typeof name==='string'?name.trim().replace(/\s+/g,' '):'';
 const es=lang==='es',greeting=es?(name?`Hola, ${name}:`:'Hola:'):(name?`Hi ${name},`:'Hi,');
 const event=config.event||'Cafe Compute',subject=es?`Tu enlace personal · ${event}`:`Your personal link · ${event}`;
 const intro=es?'Gracias por participar. Comparte tu experiencia con el equipo organizador.':'Thank you for participating. Share your experience with the organizing team.';
 const button=es?'Entrar a mi feedback':'Open my feedback';
 const security=es?'Enlace privado válido por 15 minutos. Solo se activa al confirmar en el sitio. Si no lo solicitaste, ignora este mensaje.':'Private link valid for 15 minutes. It activates only when you confirm on the site. If you did not request it, ignore this message.';
 return {subject,text:`${greeting}\n\n${event}\n${intro}\n\n${button}: ${link}\n\n${security}`,html:`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#faf5eb;color:#292620;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td style="padding:32px 16px"><table role="presentation" style="max-width:580px;margin:auto;background:white;border:1px solid #e7dfd2"><tr><td style="padding:28px"><p style="font-size:22px;font-weight:bold">${esc(event)}</p><p>${esc(greeting)}</p><h1>${es?'Sigamos la conversación.':'Keep the conversation going.'}</h1><p>${intro}</p><p style="margin:28px 0"><a href="${esc(link)}" style="background:#99330e;color:white;padding:16px 24px;border-radius:6px;display:inline-block;text-decoration:none">${button}</a></p><p style="line-height:1.6">${security}</p></td></tr></table></td></tr></table></body></html>`};
}
