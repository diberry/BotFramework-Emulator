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

import { ForkEffect, put, takeEvery, } from 'redux-saga/effects';
import { NavBarActions, SelectNavBarAction } from '../action/navBarActions';
import { markAllAsRead } from '../action/notificationActions';
import * as Constants from '../../constants';
import { SharedConstants } from '@bfemulator/app-shared';
import { CommandServiceImpl } from '../../platform/commands/commandServiceImpl';

/** Marks all notifications as read if the notifications pane is opened */
export function* markNotificationsAsRead(action: SelectNavBarAction): IterableIterator<any> {
  const navBarSelection = action.payload.selection;
  if (navBarSelection === Constants.NAVBAR_NOTIFICATIONS) {
    yield put(markAllAsRead());
  }
}

export function* startWatchingResources(action: SelectNavBarAction): IterableIterator<any> {
  if (action.payload.selection !== Constants.NAVBAR_RESOURCES) {
    return;
  }
  yield Promise.all([
    CommandServiceImpl.remoteCall(SharedConstants.Commands.Bot.WatchForChatFiles),
    CommandServiceImpl.remoteCall(SharedConstants.Commands.Bot.WatchForTranscriptFiles)
  ]);
}

export function* navBarSagas(): IterableIterator<ForkEffect> {
  yield takeEvery(NavBarActions.select, markNotificationsAsRead);
  yield takeEvery(NavBarActions.select, startWatchingResources);
}
