import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Tutorials',
      link: {
        type: 'generated-index',
        title: 'Tutorials',
        description: 'Learning-oriented guided lessons. Follow these step-by-step to build something with Apiary.',
        slug: '/category/tutorials',
      },
      items: [
        'tutorials/your-first-apiary',
        'tutorials/sensor-data-pipeline',
        'tutorials/multi-node-swarm',
      ],
    },
    {
      type: 'category',
      label: 'How-to Guides',
      link: {
        type: 'generated-index',
        title: 'How-to Guides',
        description: 'Task-oriented practical guides for common Apiary operations.',
        slug: '/category/how-to-guides',
      },
      items: [
        'how-to/install-apiary',
        'how-to/install-windows',
        'how-to/write-and-query-data',
        'how-to/deploy-raspberry-pi',
        'how-to/deploy-docker',
        'how-to/deploy-pi-profiles',
        'how-to/deploy-kubernetes',
        'how-to/add-nodes-to-swarm',
        'how-to/configure-storage-backends',
        'how-to/monitor-swarm-health',
        'how-to/run-as-systemd-service',
        'how-to/troubleshooting',
        'how-to/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'generated-index',
        title: 'Reference',
        description: 'Technical reference for APIs, SQL syntax, configuration, and terminology.',
        slug: '/category/reference',
      },
      items: [
        'reference/python-sdk',
        'reference/sql-reference',
        'reference/configuration',
        'reference/errors',
        'reference/benchmarks',
        'reference/cli',
        'reference/storage-layout',
        'reference/glossary',
      ],
    },
    {
      type: 'category',
      label: 'Explanation',
      link: {
        type: 'generated-index',
        title: 'Explanation',
        description: "Understanding-oriented discussions of Apiary's architecture, design decisions, and roadmap.",
        slug: '/category/explanation',
      },
      items: [
        'explanation/core-concepts',
        'explanation/architecture-overview',
        'explanation/storage-engine',
        'explanation/swarm-coordination',
        'explanation/query-execution',
        'explanation/behavioral-model',
        'explanation/design-decisions',
        'explanation/roadmap',
      ],
    },
  ],
};

export default sidebars;
