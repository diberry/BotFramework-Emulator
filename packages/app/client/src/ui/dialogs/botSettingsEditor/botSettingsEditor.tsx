//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import { BotInfo, newNotification, Notification, NotificationType, SharedConstants } from '@bfemulator/app-shared';
import { BotConfigWithPath, BotConfigWithPathImpl } from '@bfemulator/sdk-shared';
import { Checkbox, DefaultButton, Dialog, DialogFooter, PrimaryButton, TextField } from '@bfemulator/ui-react';
import { IConnectedService, ServiceTypes } from 'botframework-config/lib/schema';
import * as React from 'react';
import { getBotInfoByPath } from '../../../data/botHelpers';
import { CommandServiceImpl } from '../../../platform/commands/commandServiceImpl';
import { ActiveBotHelper } from '../../helpers/activeBotHelper';
import * as styles from './botSettingsEditor.scss';

export interface BotSettingsEditorProps {
  bot: BotConfigWithPath;
  cancel: () => void;
  sendNotification: (notification: Notification) => void;
  window: Window;
}

export interface BotSettingsEditorState extends BotConfigWithPath {
  secret?: string;
  revealSecret?: boolean;
  dirty?: boolean;
  encryptKey?: boolean;
}

export class BotSettingsEditor extends React.Component<BotSettingsEditorProps, BotSettingsEditorState> {
  private _generatedSecret: string;

  constructor(props: BotSettingsEditorProps, context: BotSettingsEditorState) {
    super(props, context);

    const { bot } = props;
    const botInfo = getBotInfoByPath(bot.path);
    const secret = (botInfo && botInfo.secret);
    this.state = {
      ...bot,
      secret: secret || this.generatedSecret,
      revealSecret: false,
      encryptKey: !!secret
    };
  }

  componentWillReceiveProps(newProps: BotSettingsEditorProps) {
    const { path: newBotPath } = newProps.bot;
    // handling a new bot
    if (newBotPath !== this.state.path) {
      const newBotInfo: BotInfo = getBotInfoByPath(newBotPath) || {};

      this.setState({ ...newProps.bot, secret: newBotInfo.secret });
    }
  }

  render() {
    const { name, dirty, secret, revealSecret, encryptKey } = this.state;
    const disabled = !name || !dirty;
    const error = !name ? 'The bot name is required' : '';
    return (
      <Dialog cancel={ this.onCancel } title="Bot Settings" className={ styles.botSettingsEditor }>
        <TextField
          label="Name" value={ name }
          required={ true }
          onChanged={ this.onChangeName }
          errorMessage={ error }/>

        <Checkbox
          className={ styles.encryptKeyCheckBox }
          label="Encrypt keys stored in your bot configuration"
          checked={ encryptKey }
          onChange={ this.onEncryptKeyChange }/>

        <TextField
          className={ styles.key }
          label="key"
          value={ secret }
          disabled={ true }
          id="key-input"
          type={ revealSecret ? 'text' : 'password' }/>
        <ul className={ styles.actionsList }>
          <li>
            <a href="javascript:void(0);"
               onClick={ this.onRevealSecretClick }>
              { revealSecret ? 'Hide' : 'Show' }
            </a>
          </li>
          <li>
            <a href="javascript:void(0);"
               onClick={ this.onCopyClick }>
              Copy
            </a>
          </li>
          <li>
            <a href="javascript:void(0);"
               onClick={ this.onResetClick }>
              Reset
            </a>
          </li>
        </ul>

        <DialogFooter>
          <DefaultButton text="Cancel" onClick={ this.onCancel } className={ styles.cancelButton }/>
          <PrimaryButton text="Save" onClick={ this.onSaveClick }
                         className={ styles.saveButton }
                         disabled={ disabled }/>
        </DialogFooter>
      </Dialog>
    );
  }

  private onCancel = () => {
    this.props.cancel();
  }

  private onChangeName = (name) => {
    this.setState({ name, dirty: true });
  }

  private onEncryptKeyChange = (noIdea: any, value: boolean) => {
    this.setState({ encryptKey: value, secret: (value ? this.generatedSecret : ''), dirty: true });
  }

  private onSaveClick = async () => {
    const { name: botName = '', description = '', path, services, secretKey = '', secret } = this.state;
    let bot: BotConfigWithPath = BotConfigWithPathImpl.fromJSON({
      name: botName.trim(),
      description: description.trim(),
      secretKey: secret ? secretKey : '',
      path: path.trim(),
      services
    });

    const endpointService: IConnectedService = bot.services.find(service => service.type === ServiceTypes.Endpoint);

    if (bot.path === SharedConstants.TEMP_BOT_IN_MEMORY_PATH) {
      // we are currently using a mocked bot for livechat opened via protocol URI
      await this.saveBotFromProtocol(bot, endpointService, true);
    } else {
      // using a bot loaded from disk
      await this.saveBotFromDisk(bot);
    }
  }

  /** Saves a bot config from a mocked bot object used when opening a livechat session via protocol URI  */
  private saveBotFromProtocol = async (bot: BotConfigWithPath, endpointService: IConnectedService, connectArg: boolean)
    : Promise<void> => {
    const { Save, PatchBotList } = SharedConstants.Commands.Bot;
    // need to establish a location for the .bot file
    let newPath = await this.showBotSaveDialog();
    if (!newPath) {
      return null;
    }
    bot.path = newPath;
    // write new bot entry to bots.json
    const botInfo: BotInfo = {
      displayName: bot.name,
      path: newPath,
      secret: this.state.secret
    };
    await CommandServiceImpl.remoteCall(PatchBotList, SharedConstants.TEMP_BOT_IN_MEMORY_PATH, botInfo);
    await CommandServiceImpl.remoteCall(Save, bot);
    // need to set the new bot as active now that it is no longer a placeholder bot in memory
    await ActiveBotHelper.setActiveBot(bot);
    this.setState({ ...bot });

    if (connectArg && endpointService) {
      await CommandServiceImpl.call(SharedConstants.Commands.Emulator.NewLiveChat, endpointService);
    }
    this.props.cancel();
  }

  /** Saves a bot config of a bot loaded from disk */
  private saveBotFromDisk = async (bot: BotConfigWithPath): Promise<void> => {
    const { Save, PatchBotList } = SharedConstants.Commands.Bot;
    const botInfo: BotInfo = getBotInfoByPath(bot.path) || {};
    botInfo.secret = this.state.secret;
    // write updated bot entry to bots.json
    try {
      await CommandServiceImpl.remoteCall(Save, bot);
    } catch {
      // this is a problem
      const note = newNotification('There was an error updating your bot settings. ' +
        'Try removing encryption and saving again. You can then add encryption back once successful',
        NotificationType.Error);
      this.props.sendNotification(note);
      return;
    }
    await CommandServiceImpl.remoteCall(PatchBotList, bot.path, botInfo);
    this.props.cancel();
  }

  private showBotSaveDialog = async (): Promise<any> => {
    // get a safe bot file name
    // TODO - localization
    const { SanitizeString } = SharedConstants.Commands.File;
    const botFileName = await CommandServiceImpl.remoteCall(SanitizeString, this.state.name);
    const dialogOptions = {
      filters: [
        {
          name: 'Bot Files',
          extensions: ['bot']
        }
      ],
      defaultPath: botFileName,
      showsTagField: false,
      title: 'Save as',
      buttonLabel: 'Save'
    };
    return CommandServiceImpl.remoteCall(SharedConstants.Commands.Electron.ShowSaveDialog, dialogOptions);
  }

  private onRevealSecretClick = () => {
    this.setState({ revealSecret: !this.state.revealSecret });
  }

  private onCopyClick = (): void => {
    const { window } = this.props;
    const input: HTMLInputElement = window.document.getElementById('key-input') as HTMLInputElement;
    input.removeAttribute('disabled');
    const { type } = input;
    input.type = 'text';
    input.select();
    window.document.execCommand('copy');
    input.type = type;
    input.setAttribute('disabled', '');
  }

  private onResetClick = (): void => {
    this._generatedSecret = null;
    const { generatedSecret } = this;
    this.setState({ secret: generatedSecret, secretKey: '', dirty: true });
  }

  private get generatedSecret(): string {
    if (this._generatedSecret) {
      return this._generatedSecret;
    }
    const { window } = this.props;
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    return (this._generatedSecret = window.btoa(arr.reduce((str, byte) => str += String.fromCharCode(byte), '')));
  }
}
