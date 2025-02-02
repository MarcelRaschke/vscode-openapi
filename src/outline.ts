/*
 Copyright (c) 42Crunch Ltd. All rights reserved.
 Licensed under the GNU Affero General Public License version 3. See LICENSE.txt in the project root for license information.
*/

import { find, getLocation, Location, Path } from "@xliic/preserving-json-yaml-parser";
import * as vscode from "vscode";
import { Cache } from "./cache";
import { configuration } from "./configuration";
import { TagOutlineProvider } from "./outlines/tag";
import { OpenApiVersion } from "./types";

export interface Node {
  parent: Node | undefined;
  key: string | number | undefined;
  value: any;
  depth: number;
  location?: Location;
  path: Path;
}

function getChildren(node: Node): Node[] {
  if (node.value) {
    const keys = Array.isArray(node.value)
      ? Array.from(node.value.keys())
      : Object.keys(node.value);
    return keys.map((key: string | number) => ({
      parent: node,
      key,
      depth: node.depth + 1,
      value: node.value[key],
      location: getLocation(node.value, key),
      path: [...node.path, key],
    }));
  }
  return [];
}

function getChildrenByName(root: Node, names: string[]): Node[] {
  const result = [];
  if (root) {
    for (const key of names) {
      if (root.value[key]) {
        result.push({
          parent: root,
          key,
          value: root.value[key],
          depth: root.depth + 1,
          location: getLocation(root.value, key),
          path: [...root.path, key],
        });
      }
    }
  }
  return result;
}

export const outlines: { [id: string]: vscode.TreeView<Node> } = {};

abstract class OutlineProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  root?: Node;
  documentUri?: string;
  maxDepth: number = 1;
  sort: boolean;

  constructor(private context: vscode.ExtensionContext, private cache: Cache) {
    cache.onDidActiveDocumentChange(async (document) => {
      if (document) {
        const version = this.cache.getDocumentVersion(document);
        if (version !== OpenApiVersion.Unknown) {
          this.documentUri = document.uri.toString();
          const pointer = this.getRootPointer();
          const root = cache.getLastGoodParsedDocument(document);
          if (root) {
            const found = find(root, pointer);
            this.root = {
              parent: undefined,
              key: undefined,
              depth: 0,
              value: found,
              location: undefined,
              path: [],
            };
          } else {
            this.root = undefined;
          }
        }
        this._onDidChangeTreeData.fire();
      }
    });

    this.sort = configuration.get<boolean>("sortOutlines");
    configuration.onDidChange(this.onConfigurationChanged, this);
  }

  onConfigurationChanged(e: vscode.ConfigurationChangeEvent) {
    if (configuration.changed(e, "sortOutlines")) {
      this.sort = configuration.get<boolean>("sortOutlines");
      this._onDidChangeTreeData.fire();
    }
  }

  getRootPointer(): string {
    return "";
  }

  getChildren(node?: Node): Promise<Node[]> {
    if (!this.root) {
      return Promise.resolve([]);
    }

    if (!node) {
      node = this.root;
    }

    if (node.depth > this.maxDepth) {
      return Promise.resolve([]);
    }

    if (typeof node.value === "object") {
      return Promise.resolve(this.sortChildren(this.filterChildren(node, getChildren(node))));
    } else {
      return Promise.resolve([]);
    }
  }

  filterChildren(node: Node, children: Node[]) {
    return children;
  }

  sortChildren(children: Node[]) {
    if (this.sort) {
      return children.sort((a, b) => {
        const labelA = this.getLabel(a);
        const labelB = this.getLabel(b);
        return labelA.localeCompare(labelB);
      });
    }
    return children;
  }

  getTreeItem(node: Node): vscode.TreeItem {
    const label = this.getLabel(node);
    const collapsible = this.getCollapsible(node);
    const treeItem = new vscode.TreeItem(label, collapsible);
    treeItem.command = this.getCommand(node);
    treeItem.contextValue = this.getContextValue(node);
    return treeItem;
  }

  getCollapsible(node: Node): vscode.TreeItemCollapsibleState {
    const canDisplayChildren = node.depth < this.maxDepth;
    return canDisplayChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
  }

  getLabel(node: Node): string {
    return node ? String(node.key) : "<unknown>";
  }

  getCommand(node: Node): vscode.Command | undefined {
    const [editor] = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === this.documentUri
    );

    if (editor && node && node.location) {
      const { start, end } = node.location.key ? node.location.key : node.location.value;
      return {
        command: "openapi.goToLine",
        title: "",
        arguments: [
          this.documentUri,
          new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(end)),
        ],
      };
    }
    return undefined;
  }

  getContextValue(node: Node): string | undefined {
    return undefined;
  }
}

export class PathOutlineProvider extends OutlineProvider {
  maxDepth = 5;

  getRootPointer() {
    return "/paths";
  }

  filterChildren(node: Node, children: Node[]) {
    const depth = node.depth;
    if (depth === 2) {
      return children.filter((child) => {
        return ["responses", "parameters", "requestBody"].includes(String(child.key));
      });
    }
    return children;
  }

  getLabel(node: Node): string {
    if ((node.depth === 4 || node.depth === 5) && node.parent && node.parent.key == "parameters") {
      // return label for a parameter
      const label = node.value["$ref"] || node.value["name"];
      if (!label) {
        return "<unknown>";
      }
      return label;
    }
    return String(node.key);
  }

  getContextValue(node: Node) {
    if (node.depth === 1) {
      return "path";
    } else if (node.depth === 2) {
      return "operation";
    }
    return undefined;
  }
}

export class DefinitionOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/definitions";
  }
}

export class SecurityDefinitionOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/securityDefinitions";
  }
}

export class SecurityOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/security";
  }

  getLabel(node: Node): string {
    const keys = Object.keys(node.value);
    if (keys[0]) {
      return keys[0];
    }
    return "<unknown>";
  }
}

export class ComponentsOutlineProvider extends OutlineProvider {
  maxDepth = 3;
  getRootPointer() {
    return "/components";
  }
}

export class ServersOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/servers";
  }

  getLabel(node: Node): string {
    return node.value && node.value.url ? node.value.url : "<unknown>";
  }
}

export class ParametersOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/parameters";
  }
}

export class ResponsesOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/responses";
  }
}

export class GeneralTwoOutlineProvider extends OutlineProvider {
  getChildren(node?: Node): Promise<Node[]> {
    const targets = [
      "swagger",
      "host",
      "basePath",
      "info",
      "schemes",
      "consumes",
      "produces",
      "tags",
      "externalDocs",
    ];

    return Promise.resolve(getChildrenByName(this.root!, targets));
  }
}

export class GeneralThreeOutlineProvider extends OutlineProvider {
  getChildren(node?: Node): Promise<Node[]> {
    const targets = ["openapi", "info", "tags", "externalDocs"];
    return Promise.resolve(getChildrenByName(this.root!, targets));
  }
}

export class OperationIdOutlineProvider extends OutlineProvider {
  getRootPointer() {
    return "/paths";
  }

  getChildren(node?: Node): Promise<Node[]> {
    if (!this.root) {
      return Promise.resolve([]);
    }

    const operations = [];
    const paths = getChildren(this.root);
    for (const path of paths) {
      for (const operation of getChildren(path)) {
        const operationId = operation.value["operationId"];
        if (operationId) {
          operations.push(operation);
        }
      }
    }

    return Promise.resolve(this.sortChildren(operations));
  }

  getLabel(node: Node): string {
    return node.value["operationId"];
  }
}

function registerOutlineTreeView(id: string, provider: vscode.TreeDataProvider<any>): void {
  outlines[id] = vscode.window.createTreeView(id, {
    treeDataProvider: provider,
  });
  // Length is 0 if deselected
  outlines[id].onDidChangeSelection((event) => {
    vscode.commands.executeCommand("setContext", id + "Selected", event.selection.length > 0);
  });
}

export function registerOutlines(
  context: vscode.ExtensionContext,
  cache: Cache
): vscode.Disposable[] {
  // OpenAPI v2 outlines
  registerOutlineTreeView("openapiTwoSpecOutline", new GeneralTwoOutlineProvider(context, cache));
  registerOutlineTreeView("openapiTwoPathOutline", new PathOutlineProvider(context, cache));
  registerOutlineTreeView("openapiTwoTagsOutline", new TagOutlineProvider(context, cache));

  registerOutlineTreeView(
    "openapiTwoOperationIdOutline",
    new OperationIdOutlineProvider(context, cache)
  );

  registerOutlineTreeView(
    "openapiTwoDefinitionOutline",
    new DefinitionOutlineProvider(context, cache)
  );
  registerOutlineTreeView("openapiTwoSecurityOutline", new SecurityOutlineProvider(context, cache));
  registerOutlineTreeView(
    "openapiTwoSecurityDefinitionOutline",
    new SecurityDefinitionOutlineProvider(context, cache)
  );
  registerOutlineTreeView(
    "openapiTwoParametersOutline",
    new ParametersOutlineProvider(context, cache)
  );
  registerOutlineTreeView(
    "openapiTwoResponsesOutline",
    new ResponsesOutlineProvider(context, cache)
  );

  // OpenAPI v3 outlines
  registerOutlineTreeView("openapiThreePathOutline", new PathOutlineProvider(context, cache));
  registerOutlineTreeView("openapiThreeTagsOutline", new TagOutlineProvider(context, cache));
  registerOutlineTreeView(
    "openapiThreeOperationIdOutline",
    new OperationIdOutlineProvider(context, cache)
  );

  registerOutlineTreeView(
    "openapiThreeSpecOutline",
    new GeneralThreeOutlineProvider(context, cache)
  );
  registerOutlineTreeView(
    "openapiThreeComponentsOutline",
    new ComponentsOutlineProvider(context, cache)
  );
  registerOutlineTreeView(
    "openapiThreeSecurityOutline",
    new SecurityOutlineProvider(context, cache)
  );
  registerOutlineTreeView("openapiThreeServersOutline", new ServersOutlineProvider(context, cache));

  return Object.values(outlines);
}
