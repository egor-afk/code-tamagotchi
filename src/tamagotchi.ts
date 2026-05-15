import * as vscode from 'vscode';
import type { PetViewProvider } from './petView';

export type SkinId = 'cat' | 'dog' | 'hedgehog' | 'default';

const SKIN_IDS: readonly SkinId[] = ['default', 'cat', 'dog', 'hedgehog'];

function parseSkinId(value: unknown): SkinId | undefined {
	if (typeof value === 'string' && (SKIN_IDS as readonly string[]).includes(value)) {
		return value as SkinId;
	}
	return undefined;
}

export class Tamagotchi {
	private health: number = 100
    private hunger: number = 50;
    private happiness: number = 50;
	private level: number = 1;
	private experience: number = 0;
    private linesWritten: number = 0;
    private achievements: Set<string> = new Set();
	private currentSkin: SkinId = 'default';
	/** Разблокированные аксессуары: 'briefcase' (ур. 5), 'crown' (ур. 10) */
	private accessories: string[] = [];
	private viewProvider?: PetViewProvider;
	private idleTimer: NodeJS.Timeout | undefined;
	private isIdle: boolean = false;
	private readonly idleTimeout: number;

    constructor(private context: vscode.ExtensionContext) {
		const minutesRaw = vscode.workspace.getConfiguration('code-tamagotchi').get<number>('idleTimeoutMinutes', 20);
		let minutes = typeof minutesRaw === 'number' && !Number.isNaN(minutesRaw) ? minutesRaw : 20;
		minutes = Math.min(120, Math.max(1, Math.round(minutes)));
		this.idleTimeout = minutes * 60 * 1000;
        this.loadState();
        this.startDecayTimer();
    }

    // Метод для обновления состояния на основе активности
    updateBasedOnCodeActivity(): void {
        this.hunger = Math.max(0, this.hunger - 5);  // Голод уменьшается
        this.happiness = Math.min(100, this.happiness + 3);  // Счастье увеличивается
    }
    
    getStatus(): string {
        if (this.hunger > 70) return '😫 Голодный';
        if (this.happiness < 30) return '😞 Грустный';
        return '😊 Довольный';
    }
    
    feed(): void {
        this.hunger = Math.max(0, this.hunger - 20);
        this.saveState();
    }

	play(): void{
		this.hunger = Math.max(0, this.hunger - 5);
		this.happiness = Math.min(100, this.happiness + 20);
        this.saveState();
	}

    clear(): void{
        this.health = 100
        this.hunger = 50;
        this.happiness = 50;
	    this.level = 1;
	    this.experience = 0;
        this.linesWritten = 0;
		this.accessories = [];
        this.saveState();
		this.viewProvider?.updateAccessories(this.accessories);
    }

	punish(): void {
        this.happiness = Math.max(0, this.happiness - 20);
        this.saveState();
    }

    onCodeWritten(newLines: number) {
        this.linesWritten += newLines;
    
        // Каждые 10 строк даем эффекты
        if (this.linesWritten % 10 === 0) {
            this.hunger = Math.min(100, this.hunger + 2);      // Программирование утомляет
            this.happiness = Math.min(100, this.happiness + 1); // Повышает счастье
            this.experience += 5;
            vscode.window.showInformationMessage(`🎉 Опыт UP! +5 XP (всего: ${this.experience})`);
            // Проверяем повышение уровня
            this.checkLevelUp();
            this.checkAchievements();

        }
        this.saveState();
    }

    /** Начисление опыта (например, за коммит или пуш в Git). */
    addExperience(amount: number, reason: string): void {
        if (amount <= 0) {
            return;
        }
        this.experience += amount;
        vscode.window.showInformationMessage(`🎉 ${reason}: +${amount} XP (всего: ${this.experience})`);
        this.checkLevelUp();
        this.checkAchievements();
        this.saveState();
    }

    private checkLevelUp(): void {
        const experienceNeeded = this.level * 100;  // 1 уровень = 100 XP, 2 уровень = 200 XP и т.д.
        while (this.experience >= experienceNeeded) {
            this.experience -= experienceNeeded;
            this.level++;
            vscode.window.showInformationMessage(
                `🎉 УРОВЕНЬ ПОВЫШЕН! Теперь уровень ${this.level}! 🎉`
            );
            this.checkAchievements();
            // Бонус за уровень: счастье +20
            this.happiness = Math.min(100, this.happiness + 20);
        }
		this.unlockAccessoriesByLevel(true);
    }

	/** Связь с WebView для обновления аксессуаров */
	setViewProvider(provider: PetViewProvider): void {
		this.viewProvider = provider;
	}

	getAccessories(): string[] {
		return [...this.accessories];
	}

	/** Разблокировка аксессуаров по текущему уровню */
	private unlockAccessoriesByLevel(notify: boolean): void {
		let changed = false;

		if (this.level >= 5 && !this.accessories.includes('briefcase')) {
			this.accessories.push('briefcase');
			changed = true;
			if (notify) {
				void vscode.window.showInformationMessage('🎒 Получен аксессуар: Портфель (Ученик)');
			}
		}

		if (this.level >= 10 && !this.accessories.includes('crown')) {
			this.accessories.push('crown');
			changed = true;
			if (notify) {
				void vscode.window.showInformationMessage('👑 Получен аксессуар: Корона (Мастер)');
			}
		}

		if (changed) {
			this.saveState();
			this.viewProvider?.updateAccessories(this.accessories);
		}
	}

    private checkAchievements(): void {
        const achievementsList = [
            { id: 'lines10', name: '🐣 Первые строки', condition: () => this.linesWritten >= 10, reward: 5 },
            { id: 'lines100', name: '📝 Новичок', condition: () => this.linesWritten >= 100, reward: 10 },
            { id: 'lines500', name: '🔥 Код-мастер', condition: () => this.linesWritten >= 500, reward: 20 },
            { id: 'lines1000', name: '🚀 Легенда', condition: () => this.linesWritten >= 1000, reward: 50 },
            { id: 'level5', name: '⭐ Ученик', condition: () => this.level >= 5, reward: 30 },
            { id: 'level10', name: '👑 Мастер', condition: () => this.level >= 10, reward: 60 }
        ];
        for (const ach of achievementsList) {
            if (!this.achievements.has(ach.id) && ach.condition()) {
                this.achievements.add(ach.id);
                this.experience += ach.reward;
                vscode.window.showInformationMessage(
                    `🏆 ДОСТИЖЕНИЕ ПОЛУЧЕНО: ${ach.name}! +${ach.reward} XP!`
                );
                this.saveState();
            }
        }
    }

    getAchievements(): string {
        const all = [
            { id: 'lines10', name: '🐣 Первые строки (10 строк)', unlocked: this.achievements.has('lines10') },
            { id: 'lines100', name: '📝 Новичок (100 строк)', unlocked: this.achievements.has('lines100') },
            { id: 'lines500', name: '🔥 Код-мастер (500 строк)', unlocked: this.achievements.has('lines500') },
            { id: 'lines1000', name: '🚀 Легенда (1000 строк)', unlocked: this.achievements.has('lines1000') },
            { id: 'level5', name: '⭐ Ученик (5 уровень)', unlocked: this.achievements.has('level5') },
            { id: 'level10', name: '👑 Мастер (10 уровень)', unlocked: this.achievements.has('level10') }
        ];
        const unlockedOnly = all.filter(a => a.unlocked === true);
        if (unlockedOnly.length === 0) {
            return '🏆 ПОЛУЧЕННЫЕ ДОСТИЖЕНИЯ 🏆\n\nПока нет достижений. Пиши код и повышай уровень!';
        }
        let result = '🏆 ПОЛУЧЕННЫЕ ДОСТИЖЕНИЯ 🏆\n\n';
        for (const a of unlockedOnly) {
            result += `✅ ${a.name}\n`;
        }
        return result;
    }

    clearAchievements(): void {
        this.achievements.clear();
        this.saveState();
    }

    getStats() {
        return {
            hunger: Math.round(this.hunger),
            happiness: Math.round(this.happiness),
            level: this.level,
            linesWritten: this.linesWritten
        };
    }

    getMoodEmoji() {
        if (this.hunger > 70) return '😫';
        if (this.happiness < 30) return '😞';
        if (this.happiness > 70) return '😊';
        return '😐';
    }

    getStatusText() {
        return `Уровень ${this.level} | Опыт ${this.experience} | 🍖 ${Math.round(this.hunger)}% | 😊 ${Math.round(this.happiness)}%`;
    }

	getSkin(): SkinId {
		return this.currentSkin;
	}

	setSkin(skin: SkinId): void {
		this.currentSkin = skin;
		this.saveState();
	}

	startIdleTimer(): void {
		if (this.idleTimer !== undefined) {
			clearTimeout(this.idleTimer);
			this.idleTimer = undefined;
		}
		this.idleTimer = setTimeout(() => {
			this.idleTimer = undefined;
			this.handleIdle();
		}, this.idleTimeout);
	}

	resetIdleTimer(): void {
		if (this.isIdle) {
			this.handleActivity();
		}
		this.startIdleTimer();
	}

	private handleIdle(): void {
		if (this.isIdle) {
			return;
		}
		this.isIdle = true;
		void vscode.window.showInformationMessage('😞 Твой питомец скучает... Возвращайся к коду!');
	}

	private handleActivity(): void {
		this.isIdle = false;
	}

    private saveState() {
        this.context.globalState.update('tamagotchiState', {
            hunger: this.hunger,
            happiness: this.happiness,
            level: this.level,
            experience: this.experience,
            linesWritten: this.linesWritten,
            achievements: Array.from(this.achievements),
            skin: this.currentSkin,
			accessories: this.accessories,
        });
		void this.context.globalState.update('skin', this.currentSkin);
		void this.context.globalState.update('accessories', this.accessories);
    }

    private loadState() {
        const saved: any = this.context.globalState.get('tamagotchiState');
        if (saved) {
            this.hunger = saved.hunger || 50;
            this.happiness = saved.happiness || 50;
            this.level = saved.level || 1;
            this.experience = saved.experience || 0;
            this.linesWritten = saved.linesWritten || 0;
            if (saved.achievements) {
                this.achievements = new Set(saved.achievements);
            }
        }
		const fromBlob = parseSkinId(saved?.skin);
		const fromKey = parseSkinId(this.context.globalState.get('skin'));
		this.currentSkin = fromBlob ?? fromKey ?? 'default';

		const savedAccessories = this.context.globalState.get<string[]>('accessories');
		if (Array.isArray(savedAccessories)) {
			this.accessories = savedAccessories.filter((id) => id === 'briefcase' || id === 'crown');
		} else if (Array.isArray(saved?.accessories)) {
			this.accessories = saved.accessories.filter((id: string) => id === 'briefcase' || id === 'crown');
		} else {
			this.accessories = [];
		}
		
		this.unlockAccessoriesByLevel(false);
    }

    private decayTimer: NodeJS.Timeout | undefined;

    private startDecayTimer(): void {
        if (this.decayTimer) {
            clearInterval(this.decayTimer);
        }
    
        this.decayTimer = setInterval(() => {
            this.hunger = Math.min(100, this.hunger + 1);
            this.happiness = Math.max(0, this.happiness - 0.5);
            if (this.hunger > 80) {
                vscode.window.showWarningMessage('😫 Питомец очень голоден! Покормите его!');
            }
            if (this.happiness < 20) {
                vscode.window.showWarningMessage('😞 Питомец очень грустный! Поиграйте с ним!');
            }
            this.saveState();
        }, 60000); // Раз в минуту
    }

    dispose(): void {
        if (this.decayTimer) {
            clearInterval(this.decayTimer);
			this.decayTimer = undefined;
        }
		if (this.idleTimer !== undefined) {
			clearTimeout(this.idleTimer);
			this.idleTimer = undefined;
		}
        this.saveState();
    }
}