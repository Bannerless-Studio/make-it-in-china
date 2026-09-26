import ambientSource from '../../content/phase1/ambient.json?raw';
import scenesSource from '../../content/phase1/scenes.json?raw';
import wordsSource from '../../content/phase1/words.json?raw';
import worldSource from '../../content/phase1/world.json?raw';
import {
  checkStrictContent,
  strictRuleNumbers,
  type ContentSite,
  type StrictIssue,
} from '../../scripts/check-level-rules.mjs';
import type { Scene, Word, World } from '../content/types';

const scenes = JSON.parse(scenesSource) as Scene[];
const words = JSON.parse(wordsSource) as Word[];
const world = JSON.parse(worldSource) as World;
const ambient = JSON.parse(ambientSource) as Record<string, unknown>[];
const result = checkStrictContent(words, scenes, world, null, ambient);
const root = document.querySelector<HTMLElement>('#preview');
if (!root) throw new Error('Missing #preview root');

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const heading = element('header');
heading.append(element('h1', 'Stage-4 content preview'));
heading.append(element(
  'p',
  `${scenes.length} scenes · ${result.sites.length} stable content sites · `
    + `${result.coverage.targetWords}/150 HSK1 words · ${result.coverage.placementsTotal} placements`,
));
root.append(heading);

const banner = element(
  'section',
  result.failed ? 'STRICT CHECK BLOCKED' : 'STRICT CHECK PASSED',
  result.failed ? 'banner blocked' : 'banner passed',
);
banner.setAttribute('role', 'status');
root.append(banner);

const controls = element('section', undefined, 'controls');
const sceneLabel = element('label', 'Scene ');
const sceneFilter = element('select');
sceneFilter.append(new Option('All scenes', ''));
for (const scene of scenes) {
  sceneFilter.append(new Option(
    `${Number.isInteger(scene.curriculumIndex) ? `S${String(scene.curriculumIndex).padStart(2, '0')} · ` : ''}${scene.id}`,
    scene.id,
  ));
}
sceneLabel.append(sceneFilter);
const ruleLabel = element('label', 'Rule ');
const ruleFilter = element('select');
ruleFilter.append(new Option('All rules', ''));
for (const rule of strictRuleNumbers) ruleFilter.append(new Option(`Rule ${rule}`, String(rule)));
ruleLabel.append(ruleFilter);
controls.append(sceneLabel, ruleLabel);
root.append(controls);

const issuesSection = element('section');
issuesSection.append(element('h2', 'Strict issues'));
const issuesList = element('ul', undefined, 'issues');
issuesSection.append(issuesList);
root.append(issuesSection);

const scenesSection = element('section');
scenesSection.append(element('h2', 'Scenes'));
const sceneList = element('div', undefined, 'scene-list');
scenesSection.append(sceneList);
root.append(scenesSection);

const slotsSection = element('section');
slotsSection.append(element('h2', 'World content sites'));
const slotList = element('div', undefined, 'site-list');
slotsSection.append(slotList);
root.append(slotsSection);

const coverageSection = element('section');
coverageSection.append(element('h2', 'Coverage'));
coverageSection.append(element(
  'p',
  `${result.coverage.targetWords}/150 target · ${result.coverage.placementsTotal}/460 placements · `
    + `${result.coverage.bonusWords} bonus`,
));
const coverageTable = element('table');
const coverageHead = element('thead');
const coverageHeadRow = element('tr');
for (const title of ['Word', 'Scenes count', 'Scene IDs']) coverageHeadRow.append(element('th', title));
coverageHead.append(coverageHeadRow);
coverageTable.append(coverageHead);
const coverageBody = element('tbody');
for (const row of result.coverage.rows) {
  const tableRow = element('tr', undefined, row.sceneCount < 3 ? 'coverage-low' : undefined);
  tableRow.append(element('td', row.word), element('td', String(row.sceneCount)), element('td', row.scenes.join(', ')));
  coverageBody.append(tableRow);
}
coverageTable.append(coverageBody);
coverageSection.append(coverageTable);
root.append(coverageSection);

function visibleIssues(): StrictIssue[] {
  const sceneId = sceneFilter.value;
  const rule = Number(ruleFilter.value);
  return result.issues.filter((issue) => {
    const matchesScene = !sceneId
      || issue.siteId.startsWith(`${sceneId}/`)
      || issue.siteId === `scene:${sceneId}`;
    return matchesScene && (!rule || issue.rule === rule);
  });
}

function issueListFor(site: ContentSite): HTMLElement {
  const list = element('ul', undefined, 'site-issues');
  const selectedRule = Number(ruleFilter.value);
  const issues = result.issues.filter((issue) =>
    issue.siteId === site.id && (!selectedRule || issue.rule === selectedRule)
  );
  if (issues.length === 0) {
    list.append(element('li', 'No issues', 'ok'));
  } else {
    for (const issue of issues) list.append(element('li', `RULE${issue.rule}: ${issue.message}`));
  }
  return list;
}

function renderSite(site: ContentSite): HTMLElement {
  const article = element('article', undefined, 'site');
  article.append(element('h4', site.id));
  article.append(element('p', site.value.hanzi ?? '(missing hanzi)', 'hanzi'));
  const details = [
    site.value.pinyin,
    site.value.en,
    site.value.audio ? `audio: ${site.value.audio}` : 'audio: missing',
    `words: ${(site.value.words ?? []).join(' · ') || 'none'}`,
  ];
  article.append(element('p', details.filter(Boolean).join(' | '), 'site-meta'));
  article.append(issueListFor(site));
  return article;
}

function renderIssues(): void {
  issuesList.replaceChildren();
  const issues = visibleIssues();
  if (issues.length === 0) {
    issuesList.append(element('li', 'No issues for the current filters.', 'ok'));
    return;
  }
  for (const issue of issues) {
    issuesList.append(element('li', `RULE${issue.rule} ${issue.severity} ${issue.siteId}: ${issue.message}`));
  }
}

function renderScenes(): void {
  sceneList.replaceChildren();
  const selectedScene = sceneFilter.value;
  for (const scene of scenes) {
    if (selectedScene && scene.id !== selectedScene) continue;
    const section = element('section', undefined, 'scene');
    section.append(element(
      'h3',
      `${Number.isInteger(scene.curriculumIndex) ? `S${String(scene.curriculumIndex).padStart(2, '0')} · ` : ''}${scene.id}`,
    ));
    section.append(element(
      'p',
      `${scene.kind} · curriculumIndex ${scene.curriculumIndex ?? 'missing'} · `
        + `introduces ${(scene.introduces ?? []).join(', ') || 'none'}`,
      'scene-meta',
    ));
    for (const exchange of scene.exchanges ?? []) {
      const exchangeSection = element('section', undefined, 'exchange');
      const novelty = result.exchangeNovelty.get(`${scene.id}/${exchange.id}`) ?? [];
      exchangeSection.append(element('h4', `${exchange.id} · new words ${novelty.length}/2`));
      exchangeSection.append(element('p', novelty.join(', ') || 'none', novelty.length > 2 ? 'novelty-fail' : 'ok'));
      exchangeSection.append(element(
        'p',
        `introduces: ${(exchange.introduces ?? []).join(', ') || 'none'} · `
          + `tests: ${(exchange.tests ?? []).join(', ') || 'none'}`,
        'site-meta',
      ));
      const exchangeSites = result.sites.filter((site) =>
        site.sceneId === scene.id && site.exchangeId === exchange.id
      );
      for (const site of exchangeSites) exchangeSection.append(renderSite(site));
      section.append(exchangeSection);
    }
    sceneList.append(section);
  }
}

function renderSlots(): void {
  slotList.replaceChildren();
  for (const site of result.sites.filter((candidate) => candidate.kind === 'slot' || candidate.kind === 'sign')) {
    slotList.append(renderSite(site));
  }
}

function render(): void {
  renderIssues();
  renderScenes();
  renderSlots();
}

sceneFilter.addEventListener('change', render);
ruleFilter.addEventListener('change', render);
render();
