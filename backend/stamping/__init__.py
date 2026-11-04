"""Framework-free PDF stamping library (implemented in WP1).

Must never import Django: it takes PDF bytes plus a numbering config and
returns stamped PDF bytes, so it can be tested without a database or HTTP.
"""
