import { decodeBase64, encodeBase64, readUtf8 } from './lib/base64.js'

                                 
            
                                
                            
                  
                  
 

                              
                                                      
                                                                                            
                                                     

self.onmessage = ({ data }                                 ) => {
  try {
    if (data.direction === 'encode') {
      const bytes = typeof data.input === 'string' ? new TextEncoder().encode(data.input) : data.input
      self.postMessage({ id: data.id, direction: 'encode', value: encodeBase64(bytes, data.urlSafe, data.padding) }                           )
    } else {
      const bytes = decodeBase64(String(data.input))
      const result                   = { id: data.id, direction: 'decode', bytes, text: readUtf8(bytes) }
      self.postMessage(result, { transfer: [bytes.buffer] })
    }
  } catch (error) {
    self.postMessage({ id: data.id, direction: 'error', error: error instanceof Error ? error.message : 'Conversion failed. Check your input and try again.' }                           )
  }
}
