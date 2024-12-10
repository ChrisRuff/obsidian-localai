import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, getBlobArrayBuffer } from 'obsidian';

interface LocalAIPluginSettings {
	localai_url: string;
	transcription_endpoint: string;
	transcription_model: string;
	text_generation_endpoint: string,
	text_generation_model: string,
}

const DEFAULT_SETTINGS: LocalAIPluginSettings = {
	//localai_url: "http://localhost:8080",
	localai_url: "http://10.0.0.34:9090",
	transcription_endpoint: '/v1/audio/transcriptions',
	transcription_model: 'whisper-1',
	text_generation_endpoint: '/v1/chat/completions',
	text_generation_model: 'qwen2.5-1.5b-instruct',
}
export const randomString = (length: number) => Array(length + 1).join((Math.random().toString(36) + '00000000000000000').slice(2, 18)).slice(0, length)
export default class LocalAIPlugin extends Plugin {
	settings: LocalAIPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'transcribe-selected',
			name: 'Transcribe Selected',
			editorCallback: async (editor, view) => {
				const selection = editor.getSelection();
				const match = selection.match(/!\[\[(.*?)\]\]/);
				if (match) {
					const filename = match[1];
					console.log(filename);

					const file = this.app.vault.getFiles().find(f=> f.name === filename)
					//@ts-ignore
					//const file = this.app.vault.adapter.basePath + "/" + this.app.vault.getFiles().find(f=> f.name === filename)?.path

					if(file)
					{
						const cursor_start = editor.getCursor('from');
						const cursor_end = editor.getCursor('to');

						const url = this.settings.localai_url + this.settings.transcription_endpoint;
						const model = this.settings.transcription_model;

						const boundary_string = `Boundary${randomString(16)}`;
						const boundary = `------${boundary_string}`;

						const file_buffer = new Blob([await this.app.vault.readBinary(file)]);
						const chunks: Uint8Array | ArrayBuffer[] = [];

						chunks.push(new TextEncoder().encode(`${boundary}\r\n`));
						chunks.push(new TextEncoder().encode(`Content-Disposition: form-data; name="file"; filename="blob"\r\nContent-Type: "application/octet-stream"\r\n\r\n`));
						chunks.push(await getBlobArrayBuffer(file_buffer));
						chunks.push(new TextEncoder().encode('\r\n'));

						chunks.push(new TextEncoder().encode(`${boundary}\r\n`));
						chunks.push(new TextEncoder().encode(`Content-Disposition: form-data; name="model"\r\n\r\n`));
						chunks.push(new TextEncoder().encode(`${model}\r\n`));
						await Promise.all(chunks);
						chunks.push(new TextEncoder().encode(`${boundary}--\r\n`));
						const payload = await new Blob(chunks).arrayBuffer();

						try {
							const request = {
								method: 'POST',
								url: url,
								contentType: `multipart/form-data; boundary=----${boundary_string}`,
								body: payload,
							}
							console.log(request);
							const response = await requestUrl(request);
							console.log(response);

							const data = response.json;
							const segments = data.segments;
							const text = segments.map((segment: any) => "\\[" + (segment.start / 1e+9) + " s\\]: " + segment.text).join("\n");

							editor.replaceRange(selection + "\n" + text, cursor_start, cursor_end);
						}
						catch (error) {
							new Notice('Error transcribing audio');
						}

					}
				}
			}

		});
		this.addCommand({
			id: 'summerize-selected',
			name: 'Summerize Selected',
			editorCallback: async (editor, view) => {
				const cursor_start = editor.getCursor('from');
				const cursor_end = editor.getCursor('to');
				const selection = editor.getSelection();
				const url = this.settings.localai_url + this.settings.text_generation_endpoint;
				const model = this.settings.text_generation_model;

				const payload = {
					model: model,
					messages: [
						{ "role": "user", "content": "Summerize the following: " },
						{ "role": "user", "content": selection },
					],
				}
				const request = {
					method: 'POST',
					url: url,
					contentType: 'application/json',
					body: JSON.stringify(payload),
				}
				console.log(request);
				const response = await requestUrl(request);
				console.log(response);

				const data = response.json;
				const text = data.choices[0].message.content;

				editor.replaceRange(selection + "\n" + text, cursor_start, cursor_end);
			}
		});

		/*
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LocalAISettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/*
class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
*/

class LocalAISettingTab extends PluginSettingTab {
	plugin: LocalAIPlugin;

	constructor(app: App, plugin: LocalAIPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl)
			.setName('LocalAI URL')
			.setDesc('Enter the url of your LocalAI instance')
			.addText(text => text
				.setPlaceholder('http://localhost:8080')
				.setValue(this.plugin.settings.localai_url)
				.onChange(async (value) => {
					this.plugin.settings.localai_url = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Transcription Endpoint')
			.setDesc('Endpoint for transcription requests')
			.addText(text => text
				.setValue(this.plugin.settings.transcription_endpoint)
				.setPlaceholder('/v1/audio/transcriptions')
				.onChange(async (value) => {
					this.plugin.settings.transcription_endpoint = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Transcription Model')
			.setDesc('Select the model to use for transcription')
			.addText(text => text
				.setPlaceholder('whisper-1')
				.setValue(this.plugin.settings.transcription_model)
				.onChange(async (value) => {
					this.plugin.settings.transcription_model = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Text Generation Endpoint')
			.setDesc('Endpoint for text generation requests')
			.addText(text => text
				.setValue(this.plugin.settings.text_generation_endpoint)
				.setPlaceholder('/v1/chat/completions')
				.onChange(async (value) => {
					this.plugin.settings.text_generation_endpoint = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Text Generation Model')
			.setDesc('Select the model to use for text generation')
			.addText(text => text
				.setPlaceholder('qwen2.5-1.5b-instruct')
				.setValue(this.plugin.settings.text_generation_model)
				.onChange(async (value) => {
					this.plugin.settings.text_generation_model = value;
					await this.plugin.saveSettings();
				}));
	}
}
