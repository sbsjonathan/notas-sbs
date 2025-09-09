// save/supabase.js - Sistema Supabase CORRIGIDO

class SupabaseSync {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.initPromise = null; // Para evitar múltiplas inicializações
        
        console.log('🔧 SupabaseSync inicializando...');
        this.initPromise = this.init();
    }

    async init() {
        try {
            await this.loadSupabaseLibrary();
            const { createClient } = supabase;
            this.supabase = createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );
            console.log('✅ Supabase conectado');
            
            // Verifica sessão existente
            this.checkExistingSession();
            
            // Monitora mudanças de conexão
            this.setupNetworkMonitoring();
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao conectar Supabase:', error);
            return false;
        }
    }

    async loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof supabase !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * VERIFICA SESSÃO EXISTENTE - SEMPRE ATUALIZADA
     */
    checkExistingSession() {
        try {
            const savedUser = localStorage.getItem('supabase_user');
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                this.currentUser = userData;
                console.log('👤 Sessão existente encontrada:', userData.usuario);
            } else {
                this.currentUser = null;
                console.log('👤 Nenhuma sessão ativa');
            }
        } catch (error) {
            console.error('❌ Erro ao verificar sessão:', error);
            this.currentUser = null;
        }
    }

    /**
     * MONITORA STATUS DE REDE
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Conexão restaurada');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📵 Conexão perdida');
        });
    }

    /**
     * GARANTE QUE ESTÁ INICIALIZADO
     */
    async ensureInitialized() {
        if (this.initPromise) {
            await this.initPromise;
        }
        return this.supabase !== null;
    }

    // ===== MÉTODOS DE AUTENTICAÇÃO =====

    async hashPassword(password) {
        // USA O MESMO SALT DO SISTEMA ORIGINAL
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'salt_app_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async cadastrarUsuario(usuario, senha, nomeCompleto) {
        await this.ensureInitialized();
        
        try {
            // Verifica se usuário já existe
            const { data: existing } = await this.supabase
                .from('usuarios')
                .select('id')
                .eq('usuario', usuario)
                .single();
                
            if (existing) {
                return { success: false, error: 'Usuário já existe' };
            }

            // Cria hash da senha
            const senhaHash = await this.hashPassword(senha);
            
            // Insere novo usuário
            const { data: newUser, error } = await this.supabase
                .from('usuarios')
                .insert({
                    usuario: usuario,
                    senha_hash: senhaHash,
                    nome_completo: nomeCompleto
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: 'Erro ao criar usuário' };
            }

            // Faz login automático
            this.currentUser = newUser;
            localStorage.setItem('supabase_user', JSON.stringify({
                id: newUser.id,
                usuario: newUser.usuario,
                nome: newUser.nome_completo
            }));

            console.log('✅ Usuário cadastrado:', newUser.usuario);
            return { success: true, userData: newUser };
            
        } catch (error) {
            console.error('❌ Erro no cadastro:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    async logarUsuario(usuario, senha) {
        await this.ensureInitialized();
        
        try {
            const senhaHash = await this.hashPassword(senha);
            
            const { data: userData, error } = await this.supabase
                .from('usuarios')
                .select('*')
                .eq('usuario', usuario)
                .eq('senha_hash', senhaHash)
                .single();

            if (error || !userData) {
                return { success: false, error: 'Usuário ou senha incorretos' };
            }

            // Salva sessão
            this.currentUser = userData;
            localStorage.setItem('supabase_user', JSON.stringify({
                id: userData.id,
                usuario: userData.usuario,
                nome: userData.nome_completo
            }));

            console.log('✅ Login realizado:', userData.usuario);
            return { success: true, userData: userData };
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            return { success: false, error: 'Erro interno' };
        }
    }
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('supabase_user');
        console.log('👋 Logout realizado');
        
        // Dispara evento para outras partes do sistema
        window.dispatchEvent(new Event('supabaseLogout'));
    }
    
    isLoggedIn() {
        // Sempre verifica o localStorage para estar atualizado
        this.checkExistingSession();
        return this.currentUser !== null;
    }
    
    getCurrentUser() {
        // Sempre verifica o localStorage para estar atualizado
        this.checkExistingSession();
        return this.currentUser;
    }

    // ===== MÉTODOS PARA RICHTEXT - CORRIGIDOS =====

    async carregarRichtextAnotacoes(semana) {
        // Garante inicialização
        await this.ensureInitialized();
        
        // Verifica se está logado (sempre atualizado)
        this.checkExistingSession();
        
        if (!this.currentUser) {
            console.log('❌ Usuário não logado - não pode carregar do Supabase');
            return null;
        }

        // Verifica conexão
        if (!this.isOnline) {
            console.log('📵 Sem conexão - não pode carregar do Supabase');
            return null;
        }

        try {
            console.log(`📥 Carregando richtext da semana ${semana}...`);
            
            const { data, error } = await this.supabase
                .from('richtext_anotacoes')
                .select('*')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .eq('tipo', 'richtext')
                .maybeSingle(); // Usa maybeSingle ao invés de single

            // PGRST116 = nenhum registro encontrado (não é erro)
            if (error && error.code !== 'PGRST116') {
                console.error('❌ Erro ao carregar richtext:', error);
                return null;
            }

            if (data && data.conteudo_html) {
                console.log(`✅ Richtext da semana ${semana} carregado (${data.conteudo_html.length} caracteres)`);
                return data.conteudo_html;
            }

            console.log(`📭 Nenhum richtext encontrado para semana ${semana}`);
            return null;
            
        } catch (error) {
            console.error('❌ Erro ao carregar richtext:', error);
            return null;
        }
    }
    
    async salvarRichtextAnotacoes(semana, conteudo) {
        // Garante inicialização
        await this.ensureInitialized();
        
        // Verifica se está logado (sempre atualizado)
        this.checkExistingSession();
        
        if (!this.currentUser) {
            return { success: false, error: 'Usuário não logado' };
        }

        // Verifica conexão
        if (!this.isOnline) {
            return { success: false, error: 'Sem conexão com internet' };
        }

        try {
            console.log(`💾 Salvando richtext da semana ${semana}...`);
            
            // Verifica se já existe registro
            const { data: existing } = await this.supabase
                .from('richtext_anotacoes')
                .select('id')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .eq('tipo', 'richtext')
                .maybeSingle();

            let result;
            
            if (existing) {
                // Atualiza registro existente
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .update({
                        conteudo_html: conteudo,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                    
                console.log('📝 Registro atualizado');
            } else {
                // Cria novo registro
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .insert({
                        usuario_id: this.currentUser.id,
                        semana: semana,
                        tipo: 'richtext',
                        conteudo_html: conteudo,
                        criado_em: new Date().toISOString(),
                        atualizado_em: new Date().toISOString()
                    })
                    .select()
                    .single();
                    
                console.log('📝 Novo registro criado');
            }

            if (result.error) {
                console.error('❌ Erro ao salvar:', result.error);
                return { success: false, error: 'Erro no banco de dados', details: result.error };
            }

            console.log(`✅ Richtext salvo (${conteudo.length} caracteres)`);
            return { success: true, data: result.data };
            
        } catch (error) {
            console.error('❌ Erro ao salvar richtext:', error);
            return { success: false, error: 'Erro de conexão', details: error };
        }
    }

    // ===== MÉTODOS PARA SENTINELA =====

    async salvarSentinelaAnotacoes(semana, estudoId, anotacoes) {
        await this.ensureInitialized();
        this.checkExistingSession();
        
        if (!this.currentUser) {
            return { success: false, error: 'Usuário não logado' };
        }

        if (!this.isOnline) {
            return { success: false, error: 'Sem conexão com internet' };
        }

        try {
            const conteudoWrapper = {
                estudo: estudoId,
                anotacoes: anotacoes,
                timestamp: new Date().toISOString()
            };
            
            const conteudoJSON = JSON.stringify(conteudoWrapper);

            // Verifica se já existe
            const { data: existing } = await this.supabase
                .from('richtext_anotacoes')
                .select('id')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .eq('tipo', 'sentinela_anotacoes')
                .maybeSingle();

            let result;
            
            if (existing) {
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .update({
                        conteudo_html: conteudoJSON,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
            } else {
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .insert({
                        usuario_id: this.currentUser.id,
                        semana: semana,
                        tipo: 'sentinela_anotacoes',
                        conteudo_html: conteudoJSON,
                        criado_em: new Date().toISOString(),
                        atualizado_em: new Date().toISOString()
                    })
                    .select()
                    .single();
            }

            if (result.error) {
                return { success: false, error: 'Erro no banco de dados', details: result.error };
            }

            console.log('✅ Anotações da Sentinela salvas');
            return { success: true, data: result.data };
            
        } catch (error) {
            console.error('❌ Erro ao salvar sentinela:', error);
            return { success: false, error: 'Erro interno', details: error };
        }
    }
    
    async carregarSentinelaAnotacoes(semana, estudoId) {
        await this.ensureInitialized();
        this.checkExistingSession();
        
        if (!this.currentUser) return null;
        if (!this.isOnline) return null;

        try {
            const { data, error } = await this.supabase
                .from('richtext_anotacoes')
                .select('conteudo_html')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .eq('tipo', 'sentinela_anotacoes')
                .maybeSingle();

            if (error || !data) return null;

            if (data.conteudo_html) {
                const wrapper = JSON.parse(data.conteudo_html);
                
                if (wrapper.estudo !== estudoId) {
                    console.warn(`⚠️ Anotação é do estudo ${wrapper.estudo}, mas página é do estudo ${estudoId}`);
                }
                
                return wrapper.anotacoes || null;
            }

            return null;
            
        } catch (error) {
            console.error('❌ Erro ao carregar sentinela:', error);
            return null;
        }
    }

    // ===== MÉTODOS AUXILIARES =====

    async listarSemanas() {
        await this.ensureInitialized();
        this.checkExistingSession();
        
        if (!this.currentUser) return [];

        try {
            const { data, error } = await this.supabase
                .from('richtext_anotacoes')
                .select('semana')
                .eq('usuario_id', this.currentUser.id)
                .eq('tipo', 'richtext');

            if (error) return [];

            // Remove duplicatas
            const semanas = [...new Set(data.map(item => item.semana))];
            return semanas.sort();
            
        } catch (error) {
            console.error('❌ Erro ao listar semanas:', error);
            return [];
        }
    }

    // ===== DEBUG =====

    getStatus() {
        return {
            conectado: !!this.supabase,
            online: this.isOnline,
            logado: !!this.currentUser,
            usuario: this.currentUser?.usuario || null
        };
    }

    debug() {
        console.log('=== DEBUG SUPABASE SYNC ===');
        console.log('Status:', this.getStatus());
        console.log('Config:', {
            url: window.SUPABASE_CONFIG?.url,
            hasKey: !!window.SUPABASE_CONFIG?.anonKey
        });
    }
}

// Instância global
try {
    window.SupabaseSync = new SupabaseSync();
    
    // Atalhos para debug
    window.supabaseStatus = () => window.SupabaseSync.getStatus();
    window.debugSupabase = () => window.SupabaseSync.debug();
    
} catch(e) {
    console.error("❌ CRÍTICO: Falha ao instanciar SupabaseSync:", e);
}

console.log('✅ SupabaseSync carregado - Sistema Supabase ativo');