import * as vscode from 'vscode';

export class Tamagotchi {
	private health: number = 100
    private hunger: number = 50;
    private happiness: number = 50;
	private level: number = 1;
	private experience: number = 0;
    private linesWritten: number = 0;
    
    constructor(private context: vscode.ExtensionContext) {
        this.loadState();
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
        this.saveState();
    }

	punish(): void {
        this.hunger = Math.min(100, this.hunger + 20);
        this.saveState();
    }

    onCodeWritten(newLines: number) {
        this.linesWritten += newLines;
        // Каждые 10 строк увеличиваем счастье и голод
        if (this.linesWritten % 10 === 0) {
            this.hunger = Math.min(100, this.hunger + 2); // Программирование утомляет
            this.happiness = Math.min(100, this.happiness + 1); // Повышает счастье
            this.experience = Math.min(100, this.experience + 5);
             vscode.window.showInformationMessage(`🎉 Опыт UP! Теперь опыт ${this.experience}!`);
            if(this.experience >= 100){
                this.level++;
                this.experience = 0;
                 vscode.window.showInformationMessage(
                `🎉 Уровень UP! Теперь уровень ${this.level}!`
            );
            }
        }
        this.saveState();
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

    private saveState() {
        this.context.globalState.update('tamagotchiState', {
            hunger: this.hunger,
            happiness: this.happiness,
            level: this.level,
            experience: this.experience,
            linesWritten: this.linesWritten
        });
    }

    private loadState() {
        const saved: any = this.context.globalState.get('tamagotchiState');
        if (saved) {
            this.hunger = saved.hunger || 50;
            this.happiness = saved.happiness || 50;
            this.level = saved.level || 1;
            this.experience = saved.experience || 0;
            this.linesWritten = saved.linesWritten || 0;
        }
    }
}