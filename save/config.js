// save/config.js (Versão Final com a Chave Mestra)

window.SUPABASE_CONFIG = {
    url: 'https://qbzeanthflbkmbelwyre.supabase.co',
    // Usando a chave 'secret' (service_role) que tem poder total.
    // Esta é a correção principal para o problema de permissão.
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiemVhbnRoZmxia21iZWx3eXJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg2OTQ2OSwiZXhwIjoyMDcyNDQ1NDY5fQ.akOh1Rfr7lgeGmUcpvC9hXhY2A49RvAUVWU9z6INedk'
};

console.log('🔧 Supabase configurado com CHAVE MESTRA (SERVICE_ROLE)');