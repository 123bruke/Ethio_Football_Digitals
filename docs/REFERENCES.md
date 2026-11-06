# Framework and model references

These links explain the selected frameworks and current model/runtime notes. Recheck upstream compatibility and security advisories before production deployment.

- **FastAPI SQL database integration:** https://fastapi.tiangolo.com/tutorial/sql-databases/
- **Hyperon / MeTTa source project:** https://github.com/trueagi-io/hyperon-experimental
- **Hyperon on PyPI:** https://pypi.org/project/hyperon/ — package metadata describes the project as experimental/pre-alpha; treat this dependency as optional and keep the Python fallback.
- **Ollama Qwen 2.5 model library:** https://ollama.com/library/qwen2.5 — includes a 1.5B model variant and lists its quantized download size around 986 MB.
- **Ollama quickstart:** https://ollama.com/ — model serving and local inference.
- **Neo4j Python driver manual:** https://neo4j.com/docs/python-manual/current/
- **scikit-learn MLPClassifier:** https://scikit-learn.org/stable/modules/generated/sklearn.neural_network.MLPClassifier.html
- **Pandas:** https://pandas.pydata.org/docs/
- **NumPy:** https://numpy.org/doc/stable/
- **SymPy:** https://docs.sympy.org/latest/index.html
- **Matplotlib:** https://matplotlib.org/stable/
- **seaborn:** https://seaborn.pydata.org/
- **Alembic:** https://alembic.sqlalchemy.org/en/latest/

The Qwen model file size is not a total RAM estimate. Model runtime, operating-system memory, prompt context, generation settings, and other services add overhead.
