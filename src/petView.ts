import * as vscode from 'vscode';
import type { SkinId, Tamagotchi } from './tamagotchi';

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export class PetViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'code-tamagotchi.petView';

	private static readonly skinFileMap: Record<SkinId, readonly string[]> = {
		default: ['media', 'pet-icon.svg'],
		cat: ['media', 'pet-icon.svg'],
		dog: ['media', 'dog-pet.svg'],
		hedgehog: ['media', 'ezhik-pet.svg'],
	};

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _tamagotchi: Tamagotchi,
		private readonly _extensionUri: vscode.Uri
	) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
		};
		webviewView.webview.onDidReceiveMessage((msg) => {
			if (msg?.type === 'ready') {
				this.refresh();
			}
		});

		webviewView.webview.html = this._getHtml(webviewView.webview);

		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this.refresh();
			}
		});
	}

	public setSkin(skin: SkinId): void {
		if (!this._view) {
			return;
		}
		const segments = PetViewProvider.skinFileMap[skin];
		const uri = vscode.Uri.joinPath(this._extensionUri, ...segments);
		const skinSrc = this._view.webview.asWebviewUri(uri).toString();
		this._view.webview.postMessage({ type: 'changeSkin', src: skinSrc });
	}

	public refresh(): void {
		if (!this._view) {
			return;
		}
		const stats = this._tamagotchi.getStats();
		this._view.webview.postMessage({
			type: 'state',
			mood: this._tamagotchi.getMoodEmoji(),
			level: stats.level,
			hunger: stats.hunger,
			happiness: stats.happiness,
		});
	}

	private _getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const skinId = this._tamagotchi.getSkin();
		const segments = PetViewProvider.skinFileMap[skinId];
		const petSrc = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...segments)).toString();

		return `<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<style nonce="${nonce}">
		:root {
			color-scheme: light dark;
		}
		body {
			margin: 0;
			padding: 12px;
			font-family: var(--vscode-font-family);
			font-size: 13px;
			color: var(--vscode-foreground);
			background: var(--vscode-sideBar-background);
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 10px;
		}
		#wrap {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-widget-border);
			border-radius: 8px;
			padding: 12px;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 8px;
		}
		#pet-image {
			width: 256px;
			height: 256px;
			object-fit: contain;
			image-rendering: pixelated;
			image-rendering: crisp-edges;
			border-radius: 4px;
		}
		#moodRow {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 22px;
			line-height: 1.2;
		}
		#mood {
			font-size: 28px;
		}
		#stats {
			font-size: 11px;
			opacity: 0.85;
			text-align: center;
			line-height: 1.4;
		}
	</style>
</head>
<body>
	<div id="wrap">
		<img id="pet-image" src="${petSrc}" width="256" height="256" alt="Питомец" />
		<div id="moodRow">
			<span id="mood" title="Настроение">😐</span>
		</div>
		<div id="stats"></div>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const moodEl = document.getElementById('mood');
		const statsEl = document.getElementById('stats');

		function applyState(data) {
			if (data.mood != null && moodEl) {
				moodEl.textContent = data.mood;
			}
			const lv = data.level != null ? data.level : '?';
			const hu = data.hunger != null ? data.hunger : '?';
			const ha = data.happiness != null ? data.happiness : '?';
			if (statsEl) {
				statsEl.textContent = 'Уровень ' + lv + ' · Голод ' + hu + '% · Счастье ' + ha + '%';
			}
		}

		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg && msg.type === 'state') {
				applyState(msg);
			} else if (msg && msg.type === 'changeSkin' && msg.src) {
				const img = document.getElementById('pet-image');
				if (img) {
					img.src = msg.src;
				}
			}
		});

		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
	}
}
