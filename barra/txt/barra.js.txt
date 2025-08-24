// barra.js - Sistema genérico de gerenciamento da barra (só ponte)

class ToolbarManager {
    constructor() {
        this.toolbarContainer = null;
        this.availableSlots = new Map();
        this.loadedPlugins = new Map();
        this.init();
    }

    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadToolbar());
        } else {
            this.loadToolbar();
        }
    }

    async loadToolbar() {
        try {
            this.toolbarContainer = document.getElementById('toolbar-container');
            
            if (!this.toolbarContainer) {
                console.error('Container da barra não encontrado');
                return;
            }

            // Cria os 6 slots vazios
            this.createSlots();
            
            console.log('✅ Barra genérica carregada - 6 slots disponíveis');
            
        } catch (error) {
            console.error('❌ Erro ao carregar a barra:', error);
        }
    }

    createSlots() {
        let slotsHTML = '';
        
        for (let i = 1; i <= 6; i++) {
            slotsHTML += `
                <div class="plugin-slot empty" data-slot="${i}" id="plugin-slot-${i}">
                    <div class="plugin-container"></div>
                </div>
            `;
            
            // Registra slot como disponível
            this.availableSlots.set(i, true);
        }
        
        this.toolbarContainer.innerHTML = slotsHTML;
        
        console.log('🎯 6 slots criados e disponíveis');
    }

    // Método público para plugins se registrarem
    registerPlugin(pluginName, slotId, pluginInstance, htmlContent) {
        // Verifica se slot está disponível
        if (!this.availableSlots.get(slotId)) {
            console.error(`❌ Slot ${slotId} não disponível`);
            return false;
        }

        // Busca o slot
        const slot = document.getElementById(`plugin-slot-${slotId}`);
        if (!slot) {
            console.error(`❌ Slot ${slotId} não encontrado`);
            return false;
        }

        // Injeta HTML do plugin
        const container = slot.querySelector('.plugin-container');
        container.innerHTML = htmlContent;
        
        // Marca slot como ocupado
        slot.classList.remove('empty');
        this.availableSlots.set(slotId, false);
        
        // Registra plugin
        this.loadedPlugins.set(`${pluginName}-${slotId}`, pluginInstance);
        
        console.log(`✅ Plugin ${pluginName} registrado no slot ${slotId}`);
        return true;
    }

    // Método para remover plugin
    unregisterPlugin(pluginName, slotId) {
        const pluginKey = `${pluginName}-${slotId}`;
        const plugin = this.loadedPlugins.get(pluginKey);
        
        if (plugin) {
            // Limpa slot
            const slot = document.getElementById(`plugin-slot-${slotId}`);
            if (slot) {
                slot.classList.add('empty');
                slot.querySelector('.plugin-container').innerHTML = '';
            }
            
            // Marca slot como disponível
            this.availableSlots.set(slotId, true);
            
            // Remove do registro
            this.loadedPlugins.delete(pluginKey);
            
            // Chama destroy do plugin se existir
            if (typeof plugin.destroy === 'function') {
                plugin.destroy();
            }
            
            console.log(`🗑️ Plugin ${pluginName} removido do slot ${slotId}`);
            return true;
        }
        
        return false;
    }

    // Métodos utilitários
    getAvailableSlots() {
        const available = [];
        this.availableSlots.forEach((isAvailable, slotId) => {
            if (isAvailable) {
                available.push(slotId);
            }
        });
        return available;
    }

    isSlotAvailable(slotId) {
        return this.availableSlots.get(slotId) === true;
    }

    getLoadedPlugins() {
        return Array.from(this.loadedPlugins.keys());
    }
}

// Inicializa o gerenciador da barra (genérico)
const toolbar = new ToolbarManager();

// Torna disponível globalmente para plugins se registrarem
window.toolbar = toolbar;