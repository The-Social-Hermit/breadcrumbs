import type { Graph } from "graphlib";
import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import {
  DATAVIEW_INDEX_DELAY,
  TRAIL_ICON,
  VIEW_TYPE_BREADCRUMBS_MATRIX,
} from "src/constants";
import type { allGraphs, internalLinkObj, SquareProps } from "src/interfaces";
import type BreadcrumbsPlugin from "src/main";
import Lists from "./Lists.svelte";
import Matrix from "./Matrix.svelte";

export default class MatrixView extends ItemView {
  private plugin: BreadcrumbsPlugin;
  private view: Matrix | Lists;
  private currGraphs: allGraphs;
  matrixQ: boolean;

  constructor(leaf: WorkspaceLeaf, plugin: BreadcrumbsPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  async onload(): Promise<void> {
    super.onload();
    await this.plugin.saveSettings();
    this.matrixQ = this.plugin.settings.defaultView;
    setTimeout(
      () =>
        this.app.workspace.onLayoutReady(async () => {
          await this.draw();
        }),
      DATAVIEW_INDEX_DELAY
    );
  }

  getViewType(): string {
    return VIEW_TYPE_BREADCRUMBS_MATRIX;
  }

  getDisplayText(): string {
    return "Breadcrumbs Matrix";
  }

  icon = TRAIL_ICON;

  async onOpen(): Promise<void> {
    await this.plugin.saveSettings();
    this.app.workspace.onLayoutReady(async () => {
      await this.draw();
    });
  }

  onClose(): Promise<void> {
    if (this.view) {
      this.view.$destroy();
    }
    return Promise.resolve();
  }

  resolvedClass(toFile: string, currFile: TFile): string {
    return this.app.metadataCache.unresolvedLinks[currFile.path][toFile] > 0
      ? "internal-link is-unresolved breadcrumbs-link"
      : "internal-link breadcrumbs-link";
  }

  // NOTE I should be able to check for duplicates in real and implied here
  squareItems(g: Graph, currFile: TFile, realQ = true): internalLinkObj[] {
    let items: string[];
    const successors = (g.successors(currFile.basename) ?? []) as string[];
    const predecessors = (g.predecessors(currFile.basename) ?? []) as string[];

    if (realQ) {
      items = successors;
    } else {
      items = predecessors;
    }
    const internalLinkObjArr: internalLinkObj[] = [];
    if (items.length) {
      items.forEach((item: string) => {
        internalLinkObjArr.push({
          to: item,
          currFile: currFile,
          cls: this.resolvedClass(item, currFile),
        });
      });
    }
    return internalLinkObjArr;
  }

  // removeDuplicateImpliedLinks(real: internalLinkObj[], implied: internalLinkObj[]) {
  //   real.forEach(realItem => {
  //     implied.forEach(impliedItem => {
  //       if(impliedItem.to === realItem.to) {
  //         implied
  //       }

  //     })
  //   })
  // }

  async draw(): Promise<void> {
    this.contentEl.empty();
    this.currGraphs = this.plugin.currGraphs;
    const currFile = this.app.workspace.getActiveFile();
    const settings = this.plugin.settings;

    const button = this.contentEl.createEl("button", {
      text: this.matrixQ ? "List" : "Matrix",
    });
    button.addEventListener("click", async () => {
      this.matrixQ = !this.matrixQ;
      button.innerText = this.matrixQ ? "List" : "Matrix";
      await this.draw();
    });

    const [parentFieldName, siblingFieldName, childFieldName] = [
      settings.showNameOrType ? settings.parentFieldName : "Parent",
      settings.showNameOrType ? settings.siblingFieldName : "Sibling",
      settings.showNameOrType ? settings.childFieldName : "Child",
    ];

    const { gParents, gSiblings, gChildren } = this.currGraphs;

    const [
      realParents,
      realSiblings,
      realChildren,
      impliedParents,
      impliedChildren,
    ] = [
      this.squareItems(gParents, currFile),
      this.squareItems(gSiblings, currFile),
      this.squareItems(gChildren, currFile),
      this.squareItems(gChildren, currFile, false),
      this.squareItems(gParents, currFile, false),
    ];

    /// Implied Siblings
    const currParents = (gParents.successors(currFile.basename) ??
      []) as string[];
    const impliedSiblingsArr: internalLinkObj[] = [];

    if (currParents.length) {
      currParents.forEach((parent) => {
        const impliedSiblings = (gParents.predecessors(parent) ??
          []) as string[];

        // The current note is always it's own implied sibling, so remove it from the list
        const indexCurrNote = impliedSiblings.indexOf(currFile.basename);
        impliedSiblings.splice(indexCurrNote, 1);

        // Create thie implied sibling SquareProps
        impliedSiblings.forEach((impliedSibling) => {
          impliedSiblingsArr.push({
            to: impliedSibling,
            currFile,
            cls: this.resolvedClass(impliedSibling, currFile),
          });
        });
      });
    }

    const parentsSquare: SquareProps = {
      realItems: realParents,
      impliedItems: impliedParents,
      fieldName: parentFieldName,
      app: this.app,
    };

    const siblingSquare: SquareProps = {
      realItems: realSiblings,
      impliedItems: impliedSiblingsArr,
      fieldName: siblingFieldName,
      app: this.app,
    };

    const childrenSquare: SquareProps = {
      realItems: realChildren,
      impliedItems: impliedChildren,
      fieldName: childFieldName,
      app: this.app,
    };

    if (this.matrixQ) {
      this.view = new Matrix({
        target: this.contentEl,
        props: {
          parents: parentsSquare,
          siblings: siblingSquare,
          children: childrenSquare,
          settings: settings,
          matrixView: this,
        },
      });
    } else {
      this.view = new Lists({
        target: this.contentEl,
        props: {
          parents: parentsSquare,
          siblings: siblingSquare,
          children: childrenSquare,
          settings: settings,
          matrixView: this,
        },
      });
    }
  }
}
