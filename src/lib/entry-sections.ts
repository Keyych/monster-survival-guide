export interface EntrySection {
  id: string;
  label: string;
}

/** Shared by the rendered Section and its server-rendered contents links. */
export function sectionId(heading: string): string {
  if (heading.startsWith('Six Rules')) return 'six-rules';
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function entrySections(body: string): EntrySection[] {
  return [...body.matchAll(/<Section\s+heading="([^"]+)"/g)].map((match) => {
    const heading = match[1];
    const id = sectionId(heading);
    let label = heading;
    if (/^Six Rules/.test(heading)) label = 'The Six Rules';
    else if (/^Where It Comes/.test(heading)) label = 'Origins';
    else if (/^What (You|People)/.test(heading)) label = 'Identification';
    else if (/^How |^The Pattern/.test(heading)) label = 'Behaviour';
    else if (/Weakness|Defence|Works Against/.test(heading)) label = 'Known counters';
    else if (/^Two Cases/.test(heading)) label = 'Encounter records';
    else if (/^Before We|^If You/.test(heading)) label = 'Introduction';
    return { id, label };
  });
}

export const recordLabels = {
  reported: 'Reported accounts',
  folklore: 'Folklore & tradition',
  constructed: 'Constructed lore',
} as const;
