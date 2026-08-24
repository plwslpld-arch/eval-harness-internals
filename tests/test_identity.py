from eval_harness_reference.identity import canonical_digest


def test_canonical_digest_ignores_mapping_key_order() -> None:
    left = {"target": "candidate", "config": {"temperature": 0, "seed": 7}}
    right = {"config": {"seed": 7, "temperature": 0}, "target": "candidate"}

    assert canonical_digest(left) == canonical_digest(right)
    assert canonical_digest(left).startswith("sha256:")
