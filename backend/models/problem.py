from enum import Enum

from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

from enum import Enum

class ExtraTag(str, Enum):
    # Arrays and ranges
    PREFIX_SUM = "prefix sum"  # Includes suffix sums
    DIFF_ARRAY = "diff array"  # Difference array
    SLIDING_WINDOW = "sliding window"
    MONOTONIC_STACK = "mono stack"  # Monotonic stack
    MONOTONIC_QUEUE = "mono queue"  # Monotonic queue/deque
    COMPRESSION = "compression"  # Coordinate compression
    SWEEP_LINE = "sweep line"
    MEX = "mex"

    # Data structures
    SEGMENT_TREE = "segtree"  # Includes lazy and persistent segment trees
    FENWICK_TREE = "fenwick"  # Binary indexed tree
    SPARSE_TABLE = "sparse table"
    ORDERED_SET = "ordered set"  # Order statistics tree
    TRIE = "trie"  # Includes binary tries
    HEAP = "heap"  # Priority queue
    SQRT_DECOMP = "sqrt decomp"  # Square-root decomposition
    MOS_ALGORITHM = "mo"  # Mo's algorithm
    DSU_ROLLBACK = "dsu rollback"

    # Search and queries
    ANSWER_SEARCH = "answer search"  # Binary search on the answer
    BINARY_LIFTING = "binary lifting"
    CYCLE_DETECTION = "cycle finding"
    OFFLINE_QUERIES = "offline"

    # Graphs
    BFS = "bfs"  # Includes multi-source BFS and 0-1 BFS
    DIJKSTRA = "dijkstra"
    BELLMAN_FORD = "bellman-ford"
    FLOYD_WARSHALL = "floyd"  # Floyd–Warshall
    TOPOLOGICAL_SORT = "toposort"
    SCC = "scc"  # Strongly connected components
    LOW_LINK = "low-link"  # Bridges and articulation points
    MST = "mst"  # Minimum spanning tree
    BIPARTITE = "bipartite"
    EULER_PATH = "euler path"  # Eulerian paths and circuits
    FUNCTIONAL_GRAPH = "functional graph"

    # Trees
    LCA = "lca"  # Lowest common ancestor
    EULER_TOUR = "euler tour"  # Tree flattening
    TREE_DIAMETER = "diameter"
    HLD = "hld"  # Heavy-light decomposition
    CENTROID = "centroid"  # Centroid decomposition
    SMALL_TO_LARGE = "small-to-large"  # Small-to-large merging

    # Dynamic programming
    KNAPSACK = "knapsack"
    SUBSET_DP = "subset dp"  # Bitmask/subset-state DP
    DIGIT_DP = "digit dp"
    INTERVAL_DP = "interval dp"
    TREE_DP = "tree dp"
    REROOTING = "rerooting"  # Rerooting DP
    DAG_DP = "dag dp"
    SOS_DP = "sos dp"  # Sum over subsets
    PROFILE_DP = "profile dp"  # Broken-profile DP
    DNC_DP = "d&c dp"  # Divide-and-conquer DP optimization
    CHT = "cht"  # Convex hull trick; includes Li Chao trees

    # Strings
    KMP = "kmp"  # Includes prefix-function techniques
    Z_FUNCTION = "z-function"
    MANACHER = "manacher"  # Palindrome radii
    AHO_CORASICK = "aho-corasick"

    # Math
    SIEVE = "sieve"  # Includes smallest-prime-factor sieves
    FACTORIZATION = "factorization"  # Prime factorization
    MODULAR = "modular"  # Modular arithmetic and inverses
    FAST_POWER = "fast power"  # Binary exponentiation
    MATRIX_POWER = "matrix power"  # Matrix exponentiation
    GCD = "gcd"  # Euclidean and extended Euclidean algorithms
    INCLUSION_EXCLUSION = "incl-excl"  # Inclusion-exclusion
    PIGEONHOLE = "pigeonhole"
    PARITY = "parity"
    GRUNDY = "grundy"  # Sprague–Grundy theory, including Nim

    # Geometry
    CONVEX_HULL = "convex hull"
    CROSS_PRODUCT = "cross product"

class Problem(Base):
    __tablename__ = "problems"

    contestID: Mapped[int] = mapped_column(primary_key=True)
    index: Mapped[str] = mapped_column(primary_key=True)
    extraTags: Mapped[list[str]] = mapped_column(JSON, default=list)
