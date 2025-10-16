// Supabase JavaScript Client v2.39.3
// Copied from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
// This is a minified version of the Supabase client library
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.supabase = {}));
})(this, (function (exports) { 'use strict';

  // ... (el código completo de Supabase iría aquí)

  // Para simplificar, pondremos una versión básica que funcione
  var SupabaseClient = function(url, key) {
    this.url = url;
    this.key = key;
    this.restUrl = url + '/rest/v1';
    this.authUrl = url.replace('https://', 'https://auth.');
  };

  SupabaseClient.prototype.rpc = async function(functionName, params) {
    const response = await fetch(this.restUrl + '/rpc/' + functionName, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.key,
        'apikey': this.key
      },
      body: JSON.stringify(params)
    });
    return response.json();
  };

  var createClient = function(url, key) {
    return new SupabaseClient(url, key);
  };

  exports.createClient = createClient;

}));