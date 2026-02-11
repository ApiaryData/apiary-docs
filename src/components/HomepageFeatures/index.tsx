import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Runs on Small Hardware',
    description: (
      <>
        Designed for Raspberry Pis, NUCs, and old laptops. Not a cloud system
        squeezed onto small hardware, but a system built for resource-constrained
        devices that scales to the cloud.
      </>
    ),
  },
  {
    title: 'Zero-Configuration Multi-Node',
    description: (
      <>
        Add a node by pointing it at the same storage bucket. No seed nodes, no
        tokens, no mesh network setup. Nodes discover each other through the
        storage layer.
      </>
    ),
  },
  {
    title: 'Biology-Driven Design',
    description: (
      <>
        Memory budgets, cell sizing, backpressure, and failure recovery are
        governed by bee-inspired behavioral algorithms. Mason bee isolation,
        leafcutter sizing, and colony temperature are not metaphors but runtime
        mechanisms.
      </>
    ),
  },
  {
    title: 'SQL + Python',
    description: (
      <>
        Query with Apache DataFusion SQL, write with Python. Apache Arrow
        provides zero-copy interop between the Rust engine and the Python SDK.
      </>
    ),
  },
  {
    title: 'Object Storage as Truth',
    description: (
      <>
        All data lives in S3, MinIO, GCS, or local filesystem. Nodes are
        stateless workers. Lose a node and lose nothing. The bucket is the
        complete system of record.
      </>
    ),
  },
  {
    title: 'ACID Transactions',
    description: (
      <>
        Ledger-based transactions using conditional writes, inspired by Delta
        Lake. No Raft, no consensus protocol. The storage layer provides the
        atomic compare-and-swap.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={styles.featureItem}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <ul className={styles.featureList}>
          {FeatureList.map((props, idx) => (
            <li key={idx}>
              <Feature {...props} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
