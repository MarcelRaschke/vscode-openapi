/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import * as vscode from "vscode";
import { delay } from "../time-util";

export async function offerUpgrade(): Promise<unknown> {
  await delay(100); // workaround for #133073

  const message = "You have insufficient usage allowance left to complete your request.";
  return vscode.window
    .showInformationMessage(message, { modal: true }, { title: "View allowance", id: "upgrade" })
    .then((choice) => {
      if (choice?.id === "upgrade") {
        vscode.commands.executeCommand("openapi.showConfiguration");
      }
    });
}
