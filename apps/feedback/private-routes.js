// Keep private pages ahead of Cloudflare Assets HTML canonicalization.
export function privatePageRoute(path){
  for(const prefix of ['/feedback','/en/feedback']){
    if([prefix,prefix+'/',prefix+'/index.html'].includes(path))return prefix+'/';
    for(const page of ['sign-in','credit']){
      const canonical=prefix+'/'+page;
      if([canonical,canonical+'/',canonical+'/index.html'].includes(path))return canonical;
    }
  }
  return null;
}
