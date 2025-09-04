// save/supabase.js - Sistema simples de sincronização (COMPLETO)

class SupabaseSync {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.pendingSync = [];
        
        this.init();
    }

    async init() {
        try {
            // Carrega Supabase do CDN
            await this.loadSupabaseLibrary();
            
            // Inicializa cliente
            const { createClient } = supabase;
            this.supabase = createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );

            console.log('✅ Supabase conectado');
            
            // Verifica se já está logado
            this.checkExistingSession();
            
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
            script.src = 'https://unpkg.com/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async checkExistingSession() {
        try {
            // MUDANÇA: Verifica localStorage ao invés de auth oficial
            const savedUser = localStorage.getItem('supabase_user');
            
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                
                // Valida se o usuário ainda existe no banco
                const { data: validUser } = await this.supabase
                    .from('usuarios')
                    .select('*')
                    .eq('id', userData.id)
                    .single();
                
                if (validUser) {
                    this.currentUser = validUser;
                    console.log('👤 Usuário logado:', this.currentUser.usuario);
                } else {
                    // Remove login inválido
                    localStorage.removeItem('supabase_user');
                    console.log('🗑️ Login expirado removido');
                }
            }
        } catch (error) {
            console.error('❌ Erro ao verificar sessão:', error);
        }
    }

    /**
     * Hash simples da senha
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'salt_app_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Cadastra novo usuário
     */
    async cadastrarUsuario(usuario, senha, nomeCompleto = '') {
        try {
            const senhaHash = await this.hashPassword(senha);
            
            // Verifica se usuário já existe
            const { data: existing } = await this.supabase
                .from('usuarios')
                .select('id')
                .eq('usuario', usuario)
                .single();

            if (existing) {
                return { success: false, error: 'Nome de usuário já existe' };
            }

            // Cria novo usuário
            const { data, error } = await this.supabase
                .from('usuarios')
                .insert({
                    usuario: usuario,
                    senha_hash: senhaHash,
                    nome_completo: nomeCompleto || usuario
                })
                .select('*')
                .single();

            if (error) {
                console.error('❌ Erro no cadastro:', error);
                return { success: false, error: 'Erro ao criar conta' };
            }

            console.log('✅ Usuário cadastrado:', data);
            return { success: true, userData: data };

        } catch (error) {
            console.error('❌ Erro no cadastro:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    /**
     * Faz login do usuário
     */
    async logarUsuario(usuario, senha) {
        try {
            const senhaHash = await this.hashPassword(senha);
            
            // Busca usuário
            const { data: userData, error } = await this.supabase
                .from('usuarios')
                .select('*')
                .eq('usuario', usuario)
                .eq('senha_hash', senhaHash)
                .single();

            if (error || !userData) {
                return { success: false, error: 'Usuário ou senha incorretos' };
            }

            // Salva sessão localmente
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

    /**
     * Salva anotações de uma semana (TABELA ANTIGA)
     */
    async salvarAnotacoes(semana, conteudo) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'Usuário não logado' };
            }

            // Verifica se já existe anotação para esta semana
            const { data: existing } = await this.supabase
                .from('anotacoes')
                .select('id')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .single();

            let result;
            if (existing) {
                // Atualiza existente
                result = await this.supabase
                    .from('anotacoes')
                    .update({
                        conteudo: conteudo,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select('*')
                    .single();
            } else {
                // Cria nova
                result = await this.supabase
                    .from('anotacoes')
                    .insert({
                        usuario_id: this.currentUser.id,
                        semana: semana,
                        conteudo: conteudo,
                        atualizado_em: new Date().toISOString()
                    })
                    .select('*')
                    .single();
            }

            if (result.error) {
                console.error('❌ Erro ao salvar:', result.error);
                return { success: false, error: 'Erro ao salvar' };
            }

            console.log(`💾 Anotações da semana ${semana} salvas`);
            return { success: true, data: result.data };

        } catch (error) {
            console.error('❌ Erro ao salvar anotações:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    /**
     * Carrega anotações de uma semana (TABELA ANTIGA)
     */
    async carregarAnotacoes(semana) {
        try {
            if (!this.currentUser) {
                return null;
            }

            const { data, error } = await this.supabase
                .from('anotacoes')
                .select('*')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Erro ao carregar:', error);
                return null;
            }

            if (data) {
                console.log(`📖 Anotações da semana ${semana} carregadas`);
                return data.conteudo;
            }

            return null;
        } catch (error) {
            console.error('❌ Erro ao carregar anotações:', error);
            return null;
        }
    }

    /**
     * Lista todas as semanas do usuário (TABELA ANTIGA)
     */
    async listarSemanas() {
        try {
            if (!this.currentUser) {
                return [];
            }

            const { data, error } = await this.supabase
                .from('anotacoes')
                .select('semana, atualizado_em')
                .eq('usuario_id', this.currentUser.id)
                .order('semana', { ascending: true });

            if (error) {
                console.error('❌ Erro ao listar semanas:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ Erro ao listar semanas:', error);
            return [];
        }
    }

    /**
     * ===== MÉTODOS PARA RICHTEXT (NOVOS) =====
     */

    /**
     * Salva anotações do richtext (TABELA ESPECÍFICA)
     */
    async salvarRichtextAnotacoes(semana, conteudo) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'Usuário não logado' };
            }

            console.log('💾 Salvando richtext:', {
                usuario: this.currentUser.usuario,
                semana: semana,
                tamanho: conteudo.length
            });

            // Verifica se já existe anotação para esta semana
            const { data: existing } = await this.supabase
                .from('richtext_anotacoes')
                .select('id')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .single();

            let result;
            if (existing) {
                // Atualiza existente
                console.log('🔄 Atualizando anotação existente...');
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .update({
                        conteudo_html: conteudo,
                        atualizado_em: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select('*')
                    .single();
            } else {
                // Cria nova
                console.log('➕ Criando nova anotação...');
                result = await this.supabase
                    .from('richtext_anotacoes')
                    .insert({
                        usuario_id: this.currentUser.id,
                        semana: semana,
                        conteudo_html: conteudo,
                        atualizado_em: new Date().toISOString()
                    })
                    .select('*')
                    .single();
            }

            if (result.error) {
                console.error('❌ Erro ao salvar richtext:', result.error);
                return { success: false, error: 'Erro ao salvar', details: result.error };
            }

            console.log(`✅ Richtext da semana ${semana} salvo!`);
            return { success: true, data: result.data };

        } catch (error) {
            console.error('❌ Erro ao salvar richtext:', error);
            return { success: false, error: 'Erro interno', details: error };
        }
    }

    /**
     * Carrega anotações do richtext (TABELA ESPECÍFICA)
     */
    async carregarRichtextAnotacoes(semana) {
        try {
            if (!this.currentUser) {
                return null;
            }

            const { data, error } = await this.supabase
                .from('richtext_anotacoes')
                .select('*')
                .eq('usuario_id', this.currentUser.id)
                .eq('semana', semana)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Erro ao carregar richtext:', error);
                return null;
            }

            if (data) {
                console.log(`📖 Richtext da semana ${semana} carregado`);
                return data.conteudo_html;
            }

            return null;
        } catch (error) {
            console.error('❌ Erro ao carregar richtext:', error);
            return null;
        }
    }

    /**
     * Verifica se está logado
     */
    isLoggedIn() {
        return this.currentUser !== null || localStorage.getItem('supabase_user') !== null;
    }

    /**
     * Pega usuário atual
     */
    getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        
        const saved = localStorage.getItem('supabase_user');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                localStorage.removeItem('supabase_user');
            }
        }
        
        return null;
    }

    /**
     * Faz logout
     */
    logout() {
        this.currentUser = null;
        localStorage.removeItem('supabase_user');
        console.log('👋 Logout realizado');
    }

    /**
     * Setup de realtime (sync automático)
     */
    setupRealtime(semana, callback) {
        if (!this.currentUser || !semana) return;

        const channel = this.supabase
            .channel(`anotacoes_${semana}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'anotacoes',
                    filter: `usuario_id=eq.${this.currentUser.id} and semana=eq.${semana}`
                },
                (payload) => {
                    console.log('🔄 Sync realtime:', payload);
                    if (callback) callback(payload);
                }
            )
            .subscribe();

        return channel;
    }
}

// Instância global
window.SupabaseSync = new SupabaseSync();