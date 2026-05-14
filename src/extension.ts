import * as vscode from 'vscode';
import { registerGitExperienceRewards } from './gitXp';
import { PetViewProvider } from './petView';
import type { SkinId } from './tamagotchi';
import { Tamagotchi } from './tamagotchi';

let pet: Tamagotchi;
let statusBarItem: vscode.StatusBarItem;
let petViewProvider: PetViewProvider | undefined;

interface SkinQuickPickItem extends vscode.QuickPickItem {
	skinId: SkinId;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Tamagotchi активирован!');

    pet = new Tamagotchi(context);

    context.subscriptions.push(registerGitExperienceRewards(pet, updateStatusBar));

    petViewProvider = new PetViewProvider(pet, context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(PetViewProvider.viewType, petViewProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        })
    );

    const showPetViewCommand = vscode.commands.registerCommand('code-tamagotchi.showPetView', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.code-tamagotchi');
    });
    
    // Создаем статус-бар элемент
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    updateStatusBar();
    statusBarItem.show();
    
    // Команда для кормления питомца
    const feedCommand = vscode.commands.registerCommand('code-tamagotchi.feed', () => {
        pet.feed();
        updateStatusBar();
        vscode.window.showInformationMessage('Питомец покормлен!');
    });

	const playCommand = vscode.commands.registerCommand('code-tamagotchi.play', () => {
        pet.play();
        updateStatusBar();
        vscode.window.showInformationMessage('Вы поиграли с питомцем!');
    });

	const clearCommand = vscode.commands.registerCommand('code-tamagotchi.clear', () => {
        pet.clear();
        pet.clearAchievements();
        updateStatusBar();
        vscode.window.showInformationMessage('Вы очистили историю!');
    });

	const punishCommand = vscode.commands.registerCommand('code-tamagotchi.punish', () => {
        pet.punish();
        updateStatusBar();
        vscode.window.showInformationMessage('Питомец наказан!');
    });

    const statsCommand = vscode.commands.registerCommand('code-tamagotchi.stats', () => {
        const stats = pet.getStats();
        vscode.window.showInformationMessage(
            `📊 СТАТИСТИКА ПИТОМЦА 📊\n` +
            `🍖 Голод: ${stats.hunger}%\n` +
            `😊 Счастье: ${stats.happiness}%\n` +
            `📈 Уровень: ${stats.level}\n` +
            `📝 Написано строк: ${stats.linesWritten}`
        );
    });

    const achievementsCommand = vscode.commands.registerCommand('code-tamagotchi.achievements', () => {
        const list = pet.getAchievements();
        vscode.window.showInformationMessage(list);
    });

	const changeSkinCommand = vscode.commands.registerCommand('code-tamagotchi.changeSkin', async () => {
		if (!pet || !petViewProvider) {
			return;
		}
		const items: SkinQuickPickItem[] = [
			{ label: '🐱 Кот', description: 'Пушистый и независимый', skinId: 'cat' },
			{ label: '🐶 Собака', description: 'Верный друг', skinId: 'dog' },
			{ label: '🦔 Ёжик', description: 'Колючий, но милый', skinId: 'hedgehog' },
			{ label: '↩️ По умолчанию', description: 'Стандартный питомец', skinId: 'default' },
		];
		const picked = await vscode.window.showQuickPick(items, {
			placeHolder: 'Выберите внешний вид питомца',
		});
		if (!picked) {
			return;
		}
		pet.setSkin(picked.skinId);
		petViewProvider.setSkin(picked.skinId);
		void vscode.window.showInformationMessage('Внешний вид питомца обновлён.');
	});

    // Отслеживаем написание кода
    vscode.workspace.onDidChangeTextDocument((event) => {
    // event содержит информацию об изменениях
    event.contentChanges.forEach(change => {
        const addedText = change.text;
        const newLines = (addedText.match(/\n/g) || []).length;
        
        if (newLines > 0) {
            pet.onCodeWritten(newLines); // Передаем количество новых строк
            updateStatusBar();
        }
    });
});

    // Добавляем в контекст для удаления при деактивации
    context.subscriptions.push(
        statusBarItem,
        feedCommand,
        playCommand,
        punishCommand,
        clearCommand,
        statsCommand,
        achievementsCommand,
        changeSkinCommand,
        showPetViewCommand
    );
}

function updateStatusBar() {
    if (pet && statusBarItem) {
        const emoji = pet.getMoodEmoji();
        statusBarItem.text = `${emoji} Тамагочи Lv.${pet.getStats().level}`;
        statusBarItem.tooltip = pet.getStatusText();
    }
    petViewProvider?.refresh();
}

export function deactivate() {
}